import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the default landing path for a signed-in user:
 * - `/business` if they own at least one business
 * - `/wallet` otherwise
 */
export async function getDefaultHome(userId?: string | null): Promise<"/business" | "/wallet"> {
  try {
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id ?? null;
    }
    if (!uid) return "/wallet";
    const { data, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", uid)
      .limit(1)
      .maybeSingle();
    if (error) return "/wallet";
    return data ? "/business" : "/wallet";
  } catch {
    return "/wallet";
  }
}
