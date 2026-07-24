import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id;
  });

export const getBillingPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: PaddleEnv }) => data)
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
      sub.paddle_subscription_id ? [sub.paddle_subscription_id] : []
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
  .inputValidator((data: { environment: PaddleEnv }) => data)
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

    if (!sub?.paddle_customer_id) return [];

    const res = await gatewayFetch(
      data.environment,
      `/transactions?customer_id=${encodeURIComponent(sub.paddle_customer_id)}&per_page=50&order_by=billed_at[DESC]`
    );
    const json = (await res.json()) as { data?: any[] };
    const items = json.data ?? [];
    return items.map((t) => ({
      id: t.id as string,
      status: t.status as string,
      billedAt: (t.billed_at ?? t.created_at) as string | null,
      currency: t.currency_code as string,
      total: t.details?.totals?.total as string | undefined,
      invoiceNumber: t.invoice_number as string | null,
      invoiceId: t.invoice_id as string | null,
    }));
  });

export const getInvoicePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; environment: PaddleEnv }) => data)
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
      `/transactions/${encodeURIComponent(data.transactionId)}`
    );
    const txJson = (await txRes.json()) as { data?: { customer_id?: string } };
    if (txJson.data?.customer_id !== sub.paddle_customer_id) {
      throw new Error("Transaction not found");
    }

    const res = await gatewayFetch(
      data.environment,
      `/transactions/${encodeURIComponent(data.transactionId)}/invoice`
    );
    const json = (await res.json()) as { data?: { url?: string } };
    if (!json.data?.url) throw new Error("Invoice not available");
    return json.data.url;
  });
