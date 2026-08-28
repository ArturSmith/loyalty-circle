import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Apple Wallet is not implemented yet — generating a `.pkpass` needs a Pass
 * Type ID certificate and private key from a paid Apple Developer account,
 * plus a PKCS#7 detached signature (which the Cloudflare Workers runtime
 * cannot produce natively).
 *
 * This gate exists so the UI can show the Apple option the moment those
 * secrets land, without another release. It mirrors `isGoogleWalletEnabled`.
 */
export const isAppleWalletEnabled = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ enabled: boolean }> => {
    const configured =
      Boolean(process.env["APPLE_WALLET_PASS_TYPE_ID"]) &&
      Boolean(process.env["APPLE_WALLET_CERT_P12"]) &&
      Boolean(process.env["APPLE_WALLET_TEAM_ID"]);
    // Even fully configured, pass generation is still unimplemented. Keeping
    // this `false` prevents shipping a button that produces a broken file.
    return { enabled: configured && false };
  },
);

export const createWalletPass = createServerFn({ method: "POST" })
  .inputValidator((data: { templateId: string; acceptedTermsVersion: number }) => {
    if (!data || typeof data.templateId !== "string" || data.templateId.length === 0) {
      throw new Error("Card is required");
    }
    if (!Number.isInteger(data.acceptedTermsVersion) || data.acceptedTermsVersion < 1) {
      throw new Error("You must accept the card terms before adding it");
    }
    return { templateId: data.templateId, acceptedTermsVersion: data.acceptedTermsVersion };
  })
  .handler(async ({ data }): Promise<WalletPassResult> => {
    const { getWalletConfig, ensureLoyaltyClass, createLoyaltyObject, buildSaveUrl } = await import(
      "@/lib/googleWallet.server"
    );
    const { PUBLIC_SITE_URL, WALLET_SAVE_ORIGINS, nextRewardLabel, claimUrlFor } = await import(
      "@/lib/walletFormat"
    );

    const config = getWalletConfig();
    if (!config) throw new Error("Google Wallet is not configured yet");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: template, error: templateError } = await supabaseAdmin
      .from("card_templates")
      .select(
        "id, title, total_steps, rewards, accent_color, bg_color, logo_url, active, accepted_by_platform, google_class_id, terms_and_conditions, terms_version, business:businesses(id, name, logo_url, accepted_by_platform)",
      )
      .eq("id", data.templateId)
      .eq("active", true)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) throw new Error("This card is not available anymore");
    if ((template as any).terms_version !== data.acceptedTermsVersion) {
      throw new Error("The card terms changed. Please review and accept the latest version.");
    }

    const tpl = template as any;
    const business = tpl.business as { id: string; name: string; logo_url: string | null; accepted_by_platform: boolean } | null;
    if (!tpl.accepted_by_platform || !business?.accepted_by_platform) {
      throw new Error("This card is awaiting platform review");
    }

    const classId = await ensureLoyaltyClass(config, {
      templateId: tpl.id,
      title: tpl.title,
      businessName: business?.name ?? "ClubCarder",
      accentColor: tpl.accent_color,
      logoUrl: tpl.logo_url ?? business?.logo_url ?? null,
      homepageUrl: `${PUBLIC_SITE_URL}/b/${business?.id ?? ""}`,
    });

    if (tpl.google_class_id !== classId) {
      await supabaseAdmin.from("card_templates").update({ google_class_id: classId } as any).eq("id", tpl.id);
    }

    const anonSecret = crypto.randomUUID();
    const { data: created, error: createError } = await supabaseAdmin
      .from("card_instances")
      .insert({
        template_id: tpl.id,
        customer_id: null,
        anon_secret: anonSecret,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_version: tpl.terms_version,
        terms_accepted_text: tpl.terms_and_conditions,
      } as any)
      .select("id")
      .single();

    if (createError) throw createError;
    if (!created) throw new Error("Card could not be created");

    const claimUrl = claimUrlFor(created.id, anonSecret);

    const objectId = await createLoyaltyObject(config, {
      instanceId: created.id,
      classId,
      businessName: business?.name ?? "ClubCarder",
      cardTitle: tpl.title,
      stampsCount: 0,
      totalSteps: tpl.total_steps,
      nextReward: nextRewardLabel(tpl.rewards, 0),
      claimUrl,
      bgColor: tpl.bg_color,
    });

    await supabaseAdmin
      .from("card_instances")
      .update({ google_object_id: objectId } as any)
      .eq("id", created.id);

    const { recordWalletPassEvent } = await import("@/lib/walletEvents.server");
    await recordWalletPassEvent({
      cardInstanceId: created.id,
      templateId: tpl.id,
      platform: "google",
      event: "created",
      objectId,
    });

    const saveUrl = await buildSaveUrl(config, objectId, WALLET_SAVE_ORIGINS);
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
      const { PUBLIC_SITE_URL, nextRewardLabel, claimUrlFor } = await import("@/lib/walletFormat");
      const config = getWalletConfig();
      if (!config) return { synced: false };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("card_instances")
        .select(
          "id, stamps_count, google_object_id, anon_secret, template:card_templates(id, title, total_steps, rewards, bg_color, google_class_id, business:businesses(name))",
        )
        .eq("id", data.instanceId)
        .maybeSingle();

      const instance = row as any;
      if (!instance || !instance.google_object_id) return { synced: false };
      const template = instance.template;
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
          ? claimUrlFor(instance.id, instance.anon_secret)
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
    }): Promise<{
      valid: boolean;
      alreadyClaimed: boolean;
      title: string | null;
      businessName: string | null;
      terms: string | null;
      termsVersion: number | null;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("card_instances")
        .select("id, customer_id, anon_secret, template:card_templates(title, terms_and_conditions, terms_version, business:businesses(name))")
        .eq("id", data.instanceId)
        .maybeSingle();

      const instance = row as any;
      if (!instance) return { valid: false, alreadyClaimed: false, title: null, businessName: null, terms: null, termsVersion: null };
      const title = instance.template?.title ?? null;
      const businessName = instance.template?.business?.name ?? null;
      const terms = instance.template?.terms_and_conditions ?? null;
      const termsVersion = instance.template?.terms_version ?? null;

      if (instance.customer_id) return { valid: false, alreadyClaimed: true, title, businessName, terms, termsVersion };
      const valid = Boolean(instance.anon_secret) && instance.anon_secret === data.secret;
      return { valid, alreadyClaimed: false, title, businessName, terms, termsVersion };
    },
  );

export const claimAnonymousCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { instanceId: string; secret: string }) => ({
    instanceId: String(data?.instanceId ?? ""),
    secret: String(data?.secret ?? ""),
  }))
  .handler(async ({ data, context }): Promise<{ instanceId: string }> => {
    const { data: claimedId, error } = await (context.supabase as any).rpc("claim_anonymous_card", {
      _instance_id: data.instanceId,
      _secret: data.secret,
    });
    if (error) throw new Error(error.message);
    const instanceId = (claimedId as string | null) ?? data.instanceId;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("card_instances")
        .update({ terms_accepted_by: context.userId })
        .eq("id", instanceId)
        .is("terms_accepted_by", null);
    } catch (acceptanceError) {
      console.error("claimAnonymousCard: linking terms acceptance failed", acceptanceError);
    }

    // A pass claimed from Google Wallet lands in the same place as one added in
    // the app, so it deserves the same greeting.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("card_instances")
        .select("template:card_templates(business_id)")
        .eq("id", instanceId)
        .maybeSingle();
      const businessId = (row as any)?.template?.business_id;
      if (businessId) {
        const { openWelcomeConversation } = await import("@/lib/chats.server");
        await openWelcomeConversation(businessId, context.userId);
      }
    } catch (chatError) {
      console.error("claimAnonymousCard: welcome chat failed", chatError);
    }

    return { instanceId };
  });
