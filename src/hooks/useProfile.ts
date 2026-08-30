import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";
import { getTabCache, setTabCache } from "@/lib/tabCache";

const PROFILE_CACHE_KEY = "profile";

export type ProfileInfo = {
  id: string;
  email: string;
  displayName: string | null;
  dateOfBirth: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  customerQrToken: string;
  hasBusiness: boolean;
  businessName: string | null;
  businessRole: "owner" | "admin" | null;
};

export function useProfile() {
  // Cached across tab switches so the Profile tab renders instantly and only
  // refreshes in the background.
  const [profile, setProfile] = useState<ProfileInfo | null>(() => getTabCache<ProfileInfo>(PROFILE_CACHE_KEY));
  const [loading, setLoading] = useState(() => getTabCache<ProfileInfo>(PROFILE_CACHE_KEY) === null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setProfile(null); setLoading(false); return; }

    const [{ data: row }, { data: ownedBusiness }, { data: membership }, { data: customerQrToken }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, created_at").eq("id", user.id).maybeSingle(),
      supabase.from("businesses").select("id,name").eq("owner_id", user.id).limit(1).maybeSingle(),
      (supabase as any)
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("get_my_customer_qr_token"),
    ]);

    const memberBusinessId = (membership as { business_id?: string } | null)?.business_id;
    const { data: memberBusiness } = !ownedBusiness && memberBusinessId
      ? await supabase.from("businesses").select("id,name").eq("id", memberBusinessId).maybeSingle()
      : { data: null };
    const business = ownedBusiness ?? memberBusiness;
    const businessRole: ProfileInfo["businessRole"] = ownedBusiness
      ? "owner"
      : memberBusiness
        ? "admin"
        : null;

    const avatarPath = row?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null;
    const avatarUrl = await resolveAvatarUrl(avatarPath);

    const next: ProfileInfo = {
      id: user.id,
      email: user.email ?? "",
      displayName:
        row?.display_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
      dateOfBirth: (user.user_metadata?.date_of_birth as string | undefined) ?? null,
      avatarPath,
      avatarUrl,
      createdAt: row?.created_at ?? user.created_at ?? null,
      // Keep the existing UUID QR usable until the migration reaches every
      // environment; once installed, the opaque token becomes canonical.
      customerQrToken: customerQrToken ?? user.id,
      hasBusiness: !!business,
      businessName: business?.name ?? null,
      businessRole,
    };
    setTabCache(PROFILE_CACHE_KEY, next);
    setProfile(next);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { profile, loading, reload: load };
}
