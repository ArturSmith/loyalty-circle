import { supabase } from "@/integrations/supabase/client";

export type WorkspaceBusiness = {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  role: "owner" | "admin";
  accepted_by_platform: boolean;
  onboarding_completed_at: string | null;
};

const WORKSPACE_COLUMNS = "id,name,city,logo_url,accepted_by_platform,onboarding_completed_at";

/** The Workspace page and Spaces switcher use the same RLS-protected list. */
export async function loadWorkspaceBusinesses(): Promise<WorkspaceBusiness[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return [];

  const [owned, memberships] = await Promise.all([
    supabase.from("businesses").select(WORKSPACE_COLUMNS)
      .eq("owner_id", auth.user.id).order("created_at", { ascending: true }),
    supabase.from("business_members").select("business_id")
      .eq("user_id", auth.user.id).eq("role", "admin").eq("status", "active"),
  ]);
  if (owned.error) throw owned.error;
  if (memberships.error) throw memberships.error;

  const ownRows = (owned.data ?? []).map((business) => ({ ...business, role: "owner" as const }));
  const ownedIds = new Set(ownRows.map((business) => business.id));
  const adminIds = [...new Set((memberships.data ?? []).map((membership) => membership.business_id))]
    .filter((id) => !ownedIds.has(id));
  const administered = adminIds.length
    ? await supabase.from("businesses").select(WORKSPACE_COLUMNS)
      .in("id", adminIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (administered.error) throw administered.error;

  return [...ownRows, ...(administered.data ?? []).map((business) => ({ ...business, role: "admin" as const }))];
}
