/**
 * Google Wallet pass reconciliation — server-only.
 *
 * Stamping happens inside a Postgres function, and pushing the result to Google
 * is a best-effort call made from the scanning device. That call can be lost, and
 * some state (a business freeze) never involves the scanner at all — so a pass
 * can drift from the card it represents.
 *
 * Rather than put a third-party API inside the stamping transaction, the last
 * pushed stamp count is recorded on the row. Anything that disagrees is stale
 * and is repaired lazily, the next time the customer opens their wallet.
 */

const INSTANCE_SELECT =
  "id, stamps_count, google_object_id, anon_secret, wallet_synced_stamps, wallet_synced_at, template:card_templates(id, title, total_steps, rewards, bg_color, google_class_id, business:businesses(id, name))";

/**
 * State that is not derived from `stamps_count` — a business being frozen or
 * unfrozen — leaves no per-row marker, so passes are also refreshed on a slow
 * cadence. Long enough that a returning customer costs us at most one write
 * per pass per day.
 */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Bounds both the wallet's response time and our call volume against Google.
 * A customer with more stale passes than this converges over consecutive opens
 * rather than in one burst.
 */
const MAX_PER_RUN = 5;

type Instance = {
  id: string;
  stamps_count: number;
  google_object_id: string | null;
  anon_secret: string | null;
  wallet_synced_stamps: number | null;
  wallet_synced_at: string | null;
  template: {
    id: string;
    title: string;
    total_steps: number;
    rewards: unknown;
    bg_color: string | null;
    google_class_id: string | null;
    business: { id: string; name: string } | null;
  } | null;
};

/** A pass is stale when what we last pushed no longer matches the card. */
export function isStale(instance: Instance, now = Date.now()): boolean {
  if (!instance.google_object_id) return false;
  if (!instance.template?.google_class_id) return false;
  if (instance.wallet_synced_stamps !== instance.stamps_count) return true;
  if (!instance.wallet_synced_at) return true;
  return now - new Date(instance.wallet_synced_at).getTime() >= REFRESH_AFTER_MS;
}

/**
 * The service-role client and the wallet config are both structural here — this
 * module only ever forwards them — so they are named rather than restated.
 */
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Config = NonNullable<
  ReturnType<Awaited<typeof import("@/lib/googleWallet.server")>["getWalletConfig"]>
>;

async function frozenBusinessIds(
  admin: Admin,
  businessIds: string[],
  environment: string,
): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set();
  const { data } = await admin.rpc("get_frozen_business_ids", {
    _ids: businessIds,
    _env: environment,
  });
  return new Set((data ?? []).map((row: { business_id: string }) => row.business_id));
}

async function pushOne(
  admin: Admin,
  config: Config,
  instance: Instance,
  frozen: boolean,
): Promise<boolean> {
  const { updateLoyaltyObject } = await import("@/lib/googleWallet.server");
  const { PUBLIC_SITE_URL, nextRewardLabel, claimUrlFor } = await import("@/lib/walletFormat");

  const template = instance.template;
  if (!template?.google_class_id) return false;

  const isAnonymous = Boolean(instance.anon_secret);
  await updateLoyaltyObject(config, {
    instanceId: instance.id,
    classId: template.google_class_id,
    businessName: template.business?.name ?? "ClubCarder",
    cardTitle: template.title,
    stampsCount: instance.stamps_count,
    totalSteps: template.total_steps,
    nextReward: nextRewardLabel(template.rewards, instance.stamps_count),
    claimUrl: isAnonymous
      ? claimUrlFor(instance.id, instance.anon_secret as string)
      : `${PUBLIC_SITE_URL}/wallet`,
    linkLabel: isAnonymous ? undefined : "Open in ClubCarder",
    frozen,
    bgColor: template.bg_color,
  });

  // Recorded only after Google accepts the write, so a failure stays stale and
  // is retried rather than being silently marked as done.
  const syncedMarker = {
    wallet_synced_stamps: instance.stamps_count,
    wallet_synced_at: new Date().toISOString(),
    // The generated Supabase types are regenerated separately from migrations,
    // so they do not know about the two sync columns yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  await admin.from("card_instances").update(syncedMarker).eq("id", instance.id);

  return true;
}

/** Repairs a single pass. Returns false rather than throwing. */
export async function syncOnePass(instanceId: string, environment: string): Promise<boolean> {
  try {
    const { getWalletConfig } = await import("@/lib/googleWallet.server");
    const config = getWalletConfig();
    if (!config) return false;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("card_instances")
      .select(INSTANCE_SELECT)
      .eq("id", instanceId)
      .maybeSingle();

    const instance = data as unknown as Instance | null;
    if (!instance?.google_object_id || !instance.template?.google_class_id) return false;

    const businessId = instance.template.business?.id;
    const frozen = businessId
      ? (await frozenBusinessIds(supabaseAdmin, [businessId], environment)).has(businessId)
      : false;

    return await pushOne(supabaseAdmin, config, instance, frozen);
  } catch (error) {
    console.error("syncOnePass failed", error);
    return false;
  }
}

/**
 * Repairs whichever of this customer's passes have drifted. Never throws: this
 * runs in the background of a wallet open and must not surface there.
 */
export async function syncStalePassesForCustomer(
  customerId: string,
  environment: string,
): Promise<{ repaired: number }> {
  try {
    const { getWalletConfig } = await import("@/lib/googleWallet.server");
    const config = getWalletConfig();
    if (!config) return { repaired: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("card_instances")
      .select(INSTANCE_SELECT)
      .eq("customer_id", customerId)
      .not("google_object_id", "is", null);

    const stale = ((data ?? []) as unknown as Instance[]).filter((i) => isStale(i));
    if (stale.length === 0) return { repaired: 0 };

    const batch = stale.slice(0, MAX_PER_RUN);
    const frozen = await frozenBusinessIds(
      supabaseAdmin,
      Array.from(
        new Set(
          batch
            .map((i) => i.template?.business?.id)
            .filter((id): id is string => typeof id === "string"),
        ),
      ),
      environment,
    );

    // One slow or rejected pass must not block the rest.
    const results = await Promise.allSettled(
      batch.map((instance) =>
        pushOne(supabaseAdmin, config, instance, frozen.has(instance.template?.business?.id ?? "")),
      ),
    );

    return {
      repaired: results.filter((r) => r.status === "fulfilled" && r.value).length,
    };
  } catch (error) {
    console.error("syncStalePassesForCustomer failed", error);
    return { repaired: 0 };
  }
}
