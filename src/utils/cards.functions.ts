import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";

export type WalletInstance = {
  id: string;
  stamps_count: number;
  completed_at: string | null;
  created_at: string;
  template: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    corner_title: string | null;
    total_steps: number;
    shape: CardShape;
    bg_color: string;
    accent_color: string;
    text_color: string;
    stamp_icon: StampIconName;
    logo_url: string | null;
    rewards: Reward[];
    grid_cols: number | null;
    business: { id: string; name: string };
  };
};

export const claimCardToWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { templateId: string }) => {
    if (!data || typeof data.templateId !== "string" || data.templateId.length === 0) {
      throw new Error("Card is required");
    }
    return { templateId: data.templateId };
  })
  .handler(async ({ data, context }): Promise<{ instanceId: string; alreadyOwned: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: template, error: templateError } = await supabaseAdmin
      .from("card_templates")
      .select("id")
      .eq("id", data.templateId)
      .eq("active", true)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) throw new Error("This card is not available anymore");

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("card_instances")
      .select("id")
      .eq("template_id", data.templateId)
      .eq("customer_id", context.userId)
      .limit(1);

    if (existingError) throw existingError;
    const existing = existingRows?.[0];
    if (existing) return { instanceId: existing.id, alreadyOwned: true };

    const { data: created, error: createError } = await supabaseAdmin
      .from("card_instances")
      .insert({ template_id: data.templateId, customer_id: context.userId })
      .select("id")
      .single();

    if (createError) throw createError;
    if (!created) throw new Error("Card could not be added");

    return { instanceId: created.id, alreadyOwned: false };
  });

export const getWalletCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ instances: WalletInstance[]; frozenBusinessIds: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("card_instances")
      .select(`id, stamps_count, completed_at, created_at,
        template:card_templates!inner(id, title, subtitle, description, corner_title, total_steps, shape, bg_color, accent_color, text_color, stamp_icon, logo_url, rewards, grid_cols,
          business:businesses!inner(id, name))`)
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const instances = ((rows ?? []) as unknown as WalletInstance[]).filter((instance) => Boolean(instance.template?.business?.id));
    const businessIds = Array.from(new Set(instances.map((instance) => instance.template.business.id)));

    if (businessIds.length === 0) {
      return { instances, frozenBusinessIds: [] };
    }

    const { data: frozenRows, error: frozenError } = await supabaseAdmin.rpc("get_frozen_business_ids", {
      _ids: businessIds,
    });

    if (frozenError) throw frozenError;

    return {
      instances,
      frozenBusinessIds: (frozenRows ?? []).map((row: { business_id: string }) => row.business_id),
    };
  });