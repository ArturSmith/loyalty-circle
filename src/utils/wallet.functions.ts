import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PUBLIC_SITE_URL = "https://clubcarder.com";

export type WalletPassResult = {
  saveUrl: string;
  instanceId: string;
  claimUrl: string;
};

export const isGoogleWalletEnabled = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ enabled: boolean }> => {
    const { getWalletConfig } = await import("@/lib/googleWallet.server");
    return { enabled: getWalletConfig() !== null };
  },
);

export const createWalletPass = createServerFn({ method: "POST" })
  .inputValidator((data: { templateId: string }) => {
    if (!data || typeof data.templateId !== "string" || data.templateId.length === 0) {
      throw new Error("Card is required");
    }
    return { templateId: data.templateId };
  })
  .handler(async ({ data }): Promise<WalletPassResult> => {
    const { getWalletConfig, ensureLoyaltyClass, createLoyaltyObject, buildSaveUrl } = await import(
      "@/lib/googleWallet.server"
    );
    const config = getWalletConfig();
    if (!config) throw new Error("Google Wallet is not configured yet");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: template, error: templateError } = await supabaseAdmin
      .from("card_templates")
      .select(
        "id, title, total_steps, rewards, accent_color, bg_color, logo_url, active, google_class_id, business:businesses(id, name, logo_url)",
      )
      .eq("id", data.templateId)
      .eq("active", true)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) throw new Error("This card is not available anymore");

    const business = (template as any).business as { id: string; name: string; logo_url: string | null };

    const classId = await ensureLoyaltyClass(config, {
      templateId: template.id,
      title: template.title,
      businessName: business?.name ?? "ClubCarder",
      accentColor: template.accent_color,
      logoUrl: template.logo_url ?? business?.logo_url ?? null,
      homepageUrl: `${PUBLIC_SITE_URL}/b/${business?.id ?? ""}`,
    });

    if (template.google_class_id !== classId) {
      await supabaseAdmin.from("card_templates").update({ google_class_id: classId }).eq("id", template.id);
    }

    const anonSecret = crypto.randomUUID();
    const { data: created, error: createError } = await supabaseAdmin
      .from("card_instances")
      .insert({ template_id: template.id, customer_id: null, anon_secret: anonSecret })
      .select("id")
      .single();

    if (createError) throw createError;
    if (!created) throw new Error("Card could not be created");

    const claimUrl = `${PUBLIC_SITE_URL}/claim/${created.id}?s=${anonSecret}`;

    const objectId = await createLoyaltyObject(config, {
      instanceId: created.id,
      classId,
      businessName: business?.name ?? "ClubCarder",
      cardTitle: template.title,
      stampsCount: 0,
      totalSteps: template.total_steps,
      nextReward: nextRewardLabel(template.rewards, 0),
      claimUrl,
      bgColor: template.bg_color,
    });

    await supabaseAdmin.from("card_instances").update({ google_object_id: objectId }).eq("id", created.id);

    const saveUrl = await buildSaveUrl(config, objectId, [PUBLIC_SITE_URL, "https://www.clubcarder.com"]);
    return { saveUrl, instanceId: created.id, claimUrl };
  });

/** Pushes the latest stamp count to the customer's Google Wallet pass. Never throws. */
export const syncWalletPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceId: string }) => {
    if (!data || typeof data.instanceId !== "string") throw new Error("Card is required");
    return { instanceId: data.instanceId };
  })
  .handler(async ({ data }): Promise<{ synced: boolean }> => {
    try {
      const { getWalletConfig, updateLoyaltyObject } = await import("@/lib/googleWallet.server");
      const config = getWalletConfig();
      if (!config) return { synced: false };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: instance } = await supabaseAdmin
        .from("card_instances")
        .select(
          "id, stamps_count, google_object_id, anon_secret, template:card_templates(id, title, total_steps, rewards, bg_color, google_class_id, business:businesses(name))",
        )
        .eq("id", data.instanceId)
        .maybeSingle();

      if (!instance || !instance.google_object_id) return { synced: false };
      const template = (instance as any).template;
      if (!template?.google_class_id) return { synced: false };

      await updateLoyaltyObject(config, {
        instanceId: instance.id,
        classId: template.google_class_id,
        businessName: template.business?.name ?? "ClubCarder",
        cardTitle: template.title,
        stampsCount: instance.stamps_count,
        totalSteps: template.total_steps,
        nextReward: nextRewardLabel(template.rewards, instance.stamps_count),
        claimUrl: instance.anon_secret
          ? `${PUBLIC_SITE_URL}/claim/${instance.id}?s=${instance.anon_secret}`
          : `${PUBLIC_SITE_URL}/wallet`,
        bgColor: template.bg_color,
      });
      return { synced: true };
    } catch (error) {
      console.error("syncWalletPass failed", error);
      return { synced: false };
    }
  });

export const getClaimPreview = createServerFn({ method: "POST" })
  .inputValidator((data: { instanceId: string; secret: string }) => ({
    instanceId: String(data?.instanceId ?? ""),
    secret: String(data?.secret ?? ""),
  }))
  .handler(
    async ({
      data,
    }): Promise<{ valid: boolean; alreadyClaimed: boolean; title: string | null; businessName: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: instance } = await supabaseAdmin
        .from("card_instances")
        .select("id, customer_id, anon_secret, template:card_templates(title, business:businesses(name))")
        .eq("id", data.instanceId)
        .maybeSingle();

      if (!instance) return { valid: false, alreadyClaimed: false, title: null, businessName: null };
      const template = (instance as any).template;
      const title = template?.title ?? null;
      const businessName = template?.business?.name ?? null;

      if (instance.customer_id) return { valid: false, alreadyClaimed: true, title, businessName };
      const valid = Boolean(instance.anon_secret) && instance.anon_secret === data.secret;
      return { valid, alreadyClaimed: false, title, businessName };
    },
  );

export const claimAnonymousCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceId: string; secret: string }) => ({
    instanceId: String(data?.instanceId ?? ""),
    secret: String(data?.secret ?? ""),
  }))
  .handler(async ({ data, context }): Promise<{ instanceId: string }> => {
    const { data: claimedId, error } = await context.supabase.rpc("claim_anonymous_card", {
      _instance_id: data.instanceId,
      _secret: data.secret,
    });
    if (error) throw new Error(error.message);
    return { instanceId: (claimedId as unknown as string) ?? data.instanceId };
  });

function nextRewardLabel(rewards: unknown, stampsCount: number): string | null {
  if (!Array.isArray(rewards)) return null;
  const upcoming = (rewards as Array<{ step?: number; label?: string }>)
    .filter((r) => typeof r?.step === "number" && r.step > stampsCount && r.label)
    .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))[0];
  if (!upcoming) return null;
  const remaining = (upcoming.step ?? 0) - stampsCount;
  return `${upcoming.label} — ${remaining} stamp${remaining === 1 ? "" : "s"} to go`;
}
