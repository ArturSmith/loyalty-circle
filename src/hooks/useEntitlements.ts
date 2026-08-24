import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import {
  entitlementsFor,
  type Entitlements,
  type LimitCheck,
  type LimitKey,
  type Permission,
  permissionsForRole,
} from "@/lib/plans";

/**
 * Resolves the current user's plan, their role in a business, and how much of
 * each limit is already consumed.
 *
 * Screens use `check("locations")` rather than counting rows themselves, so a
 * limit is enforced identically everywhere and changing a plan is a one-file edit.
 */

export type BusinessEntitlements = {
  loading: boolean;
  businessId: string | null;
  role: "owner" | "admin" | null;
  permissions: ReadonlySet<Permission>;
  can: Entitlements["can"];
  /** Permission check — distinct from `can`, which is a plan-feature check. */
  may: (permission: Permission) => boolean;
  plan: Entitlements["plan"];
  upgradeFor: Entitlements["upgradeFor"];
  usage: Record<LimitKey, number>;
  /** Whether one more of `key` may be created right now. */
  check: (key: LimitKey) => LimitCheck;
  refetch: () => void;
};

const EMPTY_USAGE: Record<LimitKey, number> = {
  locations: 0,
  loyaltyCards: 0,
  administrators: 0,
};

export function useEntitlements(): BusinessEntitlements {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    businessId: string | null;
    role: "owner" | "admin" | null;
    permissions: ReadonlySet<Permission>;
    tier: string | null;
    usage: Record<LimitKey, number>;
  }>({
    loading: true,
    businessId: null,
    role: null,
    permissions: new Set<Permission>(),
    tier: null,
    usage: EMPTY_USAGE,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
        return;
      }

      // The user may own a business, or merely be an admin of someone else's.
      const [{ data: owned }, { data: memberships }] = await Promise.all([
        supabase.from("businesses").select("id").eq("owner_id", u.user.id).limit(1),
        (supabase as any)
          .from("business_members")
          .select("business_id, role, permissions, status")
          .eq("user_id", u.user.id)
          .eq("status", "active"),
      ]);

      const ownedId = (owned as { id: string }[] | null)?.[0]?.id ?? null;
      const membership =
        (memberships as { business_id: string; role: string; permissions: string[] }[] | null)?.[0] ??
        null;

      const businessId = ownedId ?? membership?.business_id ?? null;
      const role: "owner" | "admin" | null = ownedId
        ? "owner"
        : membership
          ? (membership.role as "owner" | "admin")
          : null;

      const permissions = role
        ? permissionsForRole(role, membership?.permissions ?? [])
        : new Set<Permission>();

      // The plan is billed to the business owner, not to the admin viewing it.
      let tier: string | null = null;
      if (businessId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("owner_id")
          .eq("id", businessId)
          .maybeSingle();
        const ownerId = (biz as { owner_id?: string } | null)?.owner_id;
        if (ownerId) {
          const { data: subs } = await supabase
            .from("subscriptions")
            .select("plan_tier, status, current_period_end")
            .eq("user_id", ownerId)
            .eq("environment", getPaddleEnvironment())
            .order("created_at", { ascending: false });
          const now = Date.now();
          const active = (subs as any[] | null)?.find((s) => {
            const end = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
            if (["active", "trialing", "past_due"].includes(s.status)) return end === null || end > now;
            if (s.status === "canceled") return end !== null && end > now;
            return false;
          });
          tier = active?.plan_tier ?? null;
        }
      }

      let usage = EMPTY_USAGE;
      if (businessId) {
        const [locations, cards, admins] = await Promise.all([
          (supabase as any)
            .from("business_locations")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId),
          supabase
            .from("card_templates")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId),
          (supabase as any)
            .from("business_members")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .neq("status", "revoked"),
        ]);
        usage = {
          locations: locations.count ?? 0,
          loyaltyCards: cards.count ?? 0,
          administrators: admins.count ?? 0,
        };
      }

      if (!cancelled) {
        setState({ loading: false, businessId, role, permissions, tier, usage });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const ent = entitlementsFor(state.tier);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return {
    loading: state.loading,
    businessId: state.businessId,
    role: state.role,
    permissions: state.permissions,
    can: ent.can,
    may: (permission: Permission) => state.permissions.has(permission),
    plan: ent.plan,
    upgradeFor: ent.upgradeFor,
    usage: state.usage,
    check: (key: LimitKey) => ent.checkLimit(key, state.usage[key] ?? 0),
    refetch,
  };
}
