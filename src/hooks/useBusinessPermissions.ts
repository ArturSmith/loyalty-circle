import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { permissionsForRole, type Permission } from "@/lib/plans";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";

type BusinessRole = "owner" | "admin" | null;

type PermissionState = {
  loading: boolean;
  role: BusinessRole;
  permissions: ReadonlySet<Permission>;
};

const EMPTY = new Set<Permission>();

/** Resolves access for one specific business; it never falls back to another business. */
export function useBusinessPermissions(businessId: string | null | undefined) {
  const cacheKey = businessId ? `business-permissions:${businessId}` : null;
  const [state, setState] = useState<PermissionState>(() => {
    const cached = cacheKey ? getNavigationCache<PermissionState>(cacheKey) : null;
    return cached?.value ?? { loading: true, role: null, permissions: EMPTY };
  });

  useEffect(() => {
    let cancelled = false;
    const cached = cacheKey ? getNavigationCache<PermissionState>(cacheKey) : null;
    if (cached) setState(cached.value);
    else setState({ loading: true, role: null, permissions: EMPTY });

    (async () => {
      if (!businessId) {
        if (!cancelled) setState({ loading: false, role: null, permissions: EMPTY });
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        if (!cancelled) setState({ loading: false, role: null, permissions: EMPTY });
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", businessId)
        .maybeSingle();

      if (business?.owner_id === user.id) {
        if (!cancelled) {
          const next = { loading: false, role: "owner" as const, permissions: permissionsForRole("owner", []) };
          if (cacheKey) setNavigationCache(cacheKey, next);
          setState(next);
        }
        return;
      }

      const { data: membership } = await supabase
        .from("business_members")
        .select("role,status,permissions")
        .eq("business_id", businessId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!cancelled) {
        const role = membership ? "admin" : null;
        const granted = membership?.permissions ?? [];
        const next: PermissionState = {
          loading: false,
          role,
          permissions: role ? permissionsForRole(role, granted) : EMPTY,
        };
        if (cacheKey) setNavigationCache(cacheKey, next);
        setState(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId, cacheKey]);

  const has = useCallback(
    (permission: Permission) => state.permissions.has(permission),
    [state.permissions],
  );
  const hasAny = useCallback(
    (permissions: readonly Permission[]) =>
      permissions.some((permission) => state.permissions.has(permission)),
    [state.permissions],
  );

  return { ...state, isOwner: state.role === "owner", has, hasAny };
}
