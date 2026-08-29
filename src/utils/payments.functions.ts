import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_CURRENCY, PLANS, type PlanTier } from "@/lib/plans";

type PaddlePrice = {
  id?: string;
  product_id?: string;
  status?: string;
  name?: string | null;
  tax_mode?: "account_setting" | "external" | "internal" | "location";
  billing_cycle?: { interval?: string; frequency?: number } | null;
  unit_price?: { amount?: string; currency_code?: string } | null;
  custom_data?: Record<string, unknown> | null;
};

type PaddlePriceResponse = {
  data?: PaddlePrice | PaddlePrice[];
  error?: { code?: string; detail?: string };
};

function paddleError(result: PaddlePriceResponse, fallback: string) {
  const detail = result.error?.detail || fallback;
  return `${detail}${result.error?.code ? ` (${result.error.code})` : ""}`;
}

function isExpectedMonthlyPrice(price: PaddlePrice, amount: string) {
  return (
    price.status !== "archived" &&
    /^pri_[a-z\d]{26}$/.test(price.id ?? "") &&
    price.unit_price?.amount === amount &&
    price.unit_price.currency_code === PLAN_CURRENCY &&
    price.billing_cycle?.interval === "month" &&
    price.billing_cycle.frequency === 1
  );
}

type PaddleTransaction = {
  id: string;
  status: string;
  billed_at?: string | null;
  created_at?: string | null;
  currency_code: string;
  details?: { totals?: { total?: string } };
  invoice_number?: string | null;
  invoice_id?: string | null;
};

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { planTier: PlanTier; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const plan = PLANS[data.planTier];
    if (!plan) throw new Error("Unknown subscription plan");
    const expectedAmount = String(plan.price * 100);

    // The original Paddle connector imported a USD price under these external
    // IDs. Treat that item as the product anchor, never as proof that its amount
    // is correct for the current NOK catalogue.
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(plan.paddlePriceKey)}`,
    );
    const result = (await response.json()) as PaddlePriceResponse;
    if (!response.ok) {
      throw new Error(paddleError(result, "Paddle could not read the plan catalogue"));
    }

    const importedPrices = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    const exactImportedPrice = importedPrices.find((price) =>
      isExpectedMonthlyPrice(price, expectedAmount),
    );
    if (exactImportedPrice?.id) return exactImportedPrice.id;

    const productId = importedPrices.find((price) => /^pro_[a-z\d]{26}$/.test(price.product_id ?? ""))
      ?.product_id;
    if (!productId) {
      throw new Error(
        `No Paddle product is configured for ${plan.name} in ${data.environment}`,
      );
    }

    // A corrected price has no import_meta.external_id, so locate it by the
    // product and exact billing terms before creating anything new.
    const productResponse = await gatewayFetch(
      data.environment,
      `/prices?product_id=${encodeURIComponent(productId)}&status=active&per_page=200`,
    );
    const productResult = (await productResponse.json()) as PaddlePriceResponse;
    if (!productResponse.ok) {
      throw new Error(paddleError(productResult, "Paddle could not verify the plan price"));
    }
    const productPrices = Array.isArray(productResult.data)
      ? productResult.data
      : productResult.data
        ? [productResult.data]
        : [];
    const exactProductPrice = productPrices.find((price) =>
      isExpectedMonthlyPrice(price, expectedAmount),
    );
    if (exactProductPrice?.id) return exactProductPrice.id;

    // Creating a new price is non-destructive: the legacy USD price remains for
    // existing subscriptions, while all new ClubCarder checkouts use this exact
    // tier/currency/amount. Subsequent calls find and reuse the created price.
    const createResponse = await gatewayFetch(data.environment, "/prices", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        name: `${plan.name} monthly`,
        description: `ClubCarder ${plan.name} monthly — ${plan.price} ${PLAN_CURRENCY}`,
        billing_cycle: { interval: "month", frequency: 1 },
        tax_mode: importedPrices[0]?.tax_mode ?? "account_setting",
        unit_price: { amount: expectedAmount, currency_code: PLAN_CURRENCY },
        custom_data: { clubcarder_plan_tier: plan.tier, clubcarder_managed: true },
      }),
    });
    const createdResult = (await createResponse.json()) as PaddlePriceResponse;
    if (!createResponse.ok) {
      throw new Error(paddleError(createdResult, `Paddle could not create the ${plan.name} NOK price`));
    }
    const created = Array.isArray(createdResult.data) ? createdResult.data[0] : createdResult.data;
    if (!created?.id || !isExpectedMonthlyPrice(created, expectedAmount)) {
      throw new Error(`Paddle returned an invalid price for ${plan.name}`);
    }
    return created.id;
  });

export const getBillingPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub?.paddle_customer_id) throw new Error("No subscription found");

    const paddle = getPaddleClient(data.environment);
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : [],
    );

    const subscriptionUrl = session.urls?.subscriptions?.[0];
    return {
      overviewUrl: session.urls?.general?.overview ?? null,
      cancelUrl: subscriptionUrl?.cancelSubscription ?? null,
      updatePaymentUrl: subscriptionUrl?.updateSubscriptionPaymentMethod ?? null,
    };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: PaddleEnv; after?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_customer_id) return { items: [], nextCursor: null as string | null };

    const url = new URL(`/transactions`, "https://api.paddle.com");
    url.searchParams.set("customer_id", sub.paddle_customer_id);
    url.searchParams.set("per_page", "25");
    url.searchParams.set("order_by", "billed_at[DESC]");
    if (data.after) url.searchParams.set("after", data.after);

    const res = await gatewayFetch(data.environment, `${url.pathname}${url.search}`);
    const json = (await res.json()) as {
      data?: PaddleTransaction[];
      meta?: { pagination?: { next?: string; has_more?: boolean } };
    };
    const items = json.data ?? [];
    return {
      items: items.map((t) => ({
        id: t.id as string,
        status: t.status as string,
        billedAt: (t.billed_at ?? t.created_at) as string | null,
        currency: t.currency_code as string,
        total: t.details?.totals?.total as string | undefined,
        invoiceNumber: t.invoice_number as string | null,
        invoiceId: t.invoice_id as string | null,
      })),
      nextCursor: json.meta?.pagination?.next ?? null,
    };
  });

export const getInvoicePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { transactionId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the transaction belongs to this user's customer
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.paddle_customer_id) throw new Error("No subscription found");

    const txRes = await gatewayFetch(
      data.environment,
      `/transactions/${encodeURIComponent(data.transactionId)}`,
    );
    const txJson = (await txRes.json()) as { data?: { customer_id?: string } };
    if (txJson.data?.customer_id !== sub.paddle_customer_id) {
      throw new Error("Transaction not found");
    }

    const res = await gatewayFetch(
      data.environment,
      `/transactions/${encodeURIComponent(data.transactionId)}/invoice`,
    );
    const json = (await res.json()) as { data?: { url?: string } };
    if (!json.data?.url) throw new Error("Invoice not available");
    return json.data.url;
  });
