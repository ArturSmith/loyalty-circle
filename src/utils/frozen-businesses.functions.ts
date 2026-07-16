import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFrozenBusinessIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids: string[] }) => {
    if (!data || !Array.isArray(data.ids)) throw new Error("ids required");
    const ids = data.ids.filter((v) => typeof v === "string").slice(0, 500);
    return { ids };
  })
  .handler(async ({ data }): Promise<string[]> => {
    if (data.ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_frozen_business_ids", {
      _ids: data.ids,
    });
    if (error) throw error;
    return (rows ?? []).map((r: { business_id: string }) => r.business_id);
  });
