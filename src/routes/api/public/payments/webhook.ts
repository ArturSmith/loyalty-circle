import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";
import { PLAN_LIST, PLAN_TIERS } from "@/lib/plans";

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

/** Fall back to matching an existing customer, then to the Paddle customer's email. */
async function resolveUserId(data: any, env: PaddleEnv): Promise<string | null> {
  const fromCustomData = data?.customData?.userId;
  if (fromCustomData) return fromCustomData as string;

  const supabase = getSupabase();

  // 1. Same Paddle customer already linked to a user?
  if (data?.customerId) {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_customer_id", data.customerId)
      .eq("environment", env)
      .limit(1)
      .maybeSingle();
    if (existing?.user_id) return existing.user_id as string;
  }

  // 2. Match on the Paddle customer's email address.
  try {
    if (!data?.customerId) return null;
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const res = await gatewayFetch(env, `/customers/${encodeURIComponent(data.customerId)}`);
    const json = (await res.json()) as { data?: { email?: string } };
    const email = json.data?.email?.toLowerCase();
    if (!email) return null;
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
    return match?.id ?? null;
  } catch (e) {
    console.error("resolveUserId fallback failed", e);
    return null;
  }
}

/**
 * Which plan was bought. Checkout sends the tier in customData, but that is
 * client-supplied, so it is only trusted when it matches a known tier. The
 * Paddle price external_id is the authoritative fallback.
 */
function resolvePlanTier(data: any, priceId: string | undefined): string | null {
  const fromCustomData = data?.customData?.planTier;
  const known = PLAN_TIERS as readonly string[];
  if (typeof fromCustomData === "string" && known.includes(fromCustomData)) {
    return fromCustomData;
  }
  const byPrice = PLAN_LIST.find((p) => p.paddlePriceKey === priceId);
  return byPrice?.tier ?? null;
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {  const { id, customerId, items, status, currentBillingPeriod, scheduledChange } = data;
  const userId = await resolveUserId(data, env);
  if (!userId) {
    console.error("ORPHANED SUBSCRIPTION: could not resolve a user", {
      subscriptionId: id,
      customerId,
      env,
    });
    return;
  }
  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item.price.id,
      rawProductId: item.product.id,
    });
    return;
  }

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      plan_tier: resolvePlanTier(data, priceId),
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" }
  );
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;

  const patch: Record<string, unknown> = {
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  // Keep the plan in sync when the subscription's items change.
  if (priceId) patch.price_id = priceId;
  if (productId) patch.product_id = productId;
  // An upgrade or downgrade arrives as an update, so the tier must follow the
  // new price. customData is not resent here, so the price is the only source.
  const updatedTier = resolvePlanTier(data, priceId);
  if (updatedTier) patch.plan_tier = updatedTier;

  const { data: rows } = await getSupabase()
    .from("subscriptions")
    .update(patch)
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .select("id");

  // The update event can arrive before created (or after a missed created).
  if (!rows || rows.length === 0) {
    await handleSubscriptionCreated(data, env);
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod, canceledAt, scheduledChange } = data;
  // Preserve the paid-through date so the grace period is bounded and correct.
  const periodEnd =
    currentBillingPeriod?.endsAt ?? scheduledChange?.effectiveAt ?? canceledAt ?? new Date().toISOString();

  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: periodEnd,
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}


async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
