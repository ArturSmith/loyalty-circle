import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/lib/avatar";

export type ProfileInfo = {
  id: string;
  email: string;
  displayName: string | null;
  dateOfBirth: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  hasBusiness: boolean;
  businessName: string | null;
};

export function useProfile() {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setProfile(null); setLoading(false); return; }

    const [{ data: row }, { data: biz }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, created_at").eq("id", user.id).maybeSingle(),
      supabase.from("businesses").select("id,name").eq("owner_id", user.id).limit(1).maybeSingle(),
    ]);

    const avatarPath = row?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null;
    const avatarUrl = await resolveAvatarUrl(avatarPath);

    setProfile({
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
      hasBusiness: !!biz,
      businessName: biz?.name ?? null,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { profile, loading, reload: load };
}
