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

    try {
      // Fetch card instances with template IDs only (simpler query)
      const { data: instanceData, error: instanceError } = await supabaseAdmin
        .from("card_instances")
        .select(`id, stamps_count, completed_at, created_at, template_id`)
        .eq("customer_id", context.userId)
        .order("created_at", { ascending: false });

      if (instanceError) {
        console.error("Error fetching card instances:", instanceError);
        throw instanceError;
      }

      if (!instanceData || instanceData.length === 0) {
        return { instances: [], frozenBusinessIds: [] };
      }

      // Get template IDs
      const templateIds = Array.from(new Set(instanceData.map((inst: any) => inst.template_id)));

      // Fetch templates with business data
      const { data: templateData, error: templateError } = await supabaseAdmin
        .from("card_templates")
        .select(`id, title, subtitle, description, corner_title, total_steps, shape, bg_color, accent_color, text_color, stamp_icon, logo_url, rewards, grid_cols, business_id,
          business:businesses(id, name)`)
        .in("id", templateIds);

      if (templateError) {
        console.error("Error fetching templates:", templateError);
        throw templateError;
      }

      // Create a map of templates for quick lookup
      const templateMap = new Map((templateData ?? []).map((t: any) => [t.id, t]));

      // Merge template data into instances
      const instances: WalletInstance[] = instanceData
        .map((inst: any) => {
          const template = templateMap.get(inst.template_id);
          if (!template || !template.business?.id) return null;
          return {
            id: inst.id,
            stamps_count: inst.stamps_count,
            completed_at: inst.completed_at,
            created_at: inst.created_at,
            template: {
              id: template.id,
              title: template.title,
              subtitle: template.subtitle,
              description: template.description,
              corner_title: template.corner_title,
              total_steps: template.total_steps,
              shape: template.shape,
              bg_color: template.bg_color,
              accent_color: template.accent_color,
              text_color: template.text_color,
              stamp_icon: template.stamp_icon,
              logo_url: template.logo_url,
              rewards: template.rewards,
              grid_cols: template.grid_cols,
              business: template.business,
            },
          };
        })
        .filter((inst): inst is WalletInstance => inst !== null);

      const businessIds = Array.from(new Set(instances.map((inst) => inst.template.business.id)));

      if (businessIds.length === 0) {
        return { instances, frozenBusinessIds: [] };
      }

      const { data: frozenRows, error: frozenError } = await supabaseAdmin.rpc("get_frozen_business_ids", {
        _ids: businessIds,
      });

      if (frozenError) {
        console.error("Error fetching frozen business IDs:", frozenError);
        throw frozenError;
      }

      return {
        instances,
        frozenBusinessIds: (frozenRows ?? []).map((row: { business_id: string }) => row.business_id),
      };
    } catch (error) {
      console.error("getWalletCards error:", error);
      throw new Error(`Failed to load wallet cards: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });