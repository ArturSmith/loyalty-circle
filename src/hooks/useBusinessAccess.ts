import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export const TRIAL_DAYS = 14;

export type BusinessAccess = {
  loading: boolean;
  hasBusiness: boolean;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  isSubscribed: boolean;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  hasAccess: boolean;
  reason: "subscribed" | "trialing" | "no-business" | "trial-expired" | "loading";
  refetch: () => void;
};

export function useBusinessAccess(): BusinessAccess {
  const [state, setState] = useState<Omit<BusinessAccess, "refetch">>({
    loading: true,
    hasBusiness: false,
    trialEndsAt: null,
    trialDaysLeft: null,
    isSubscribed: false,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    hasAccess: false,
    reason: "loading",
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled)
          setState((s) => ({ ...s, loading: false, hasAccess: false, reason: "no-business" }));
        return;
      }
      const env = getPaddleEnvironment();
      const [{ data: biz }, { data: sub }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, created_at")
          .eq("owner_id", u.user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status,current_period_end,cancel_at_period_end")
          .eq("user_id", u.user.id)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const hasBusiness = !!biz;
      const created = biz ? new Date(biz.created_at as string) : null;
      const trialEndsAt = created ? new Date(created.getTime() + TRIAL_DAYS * 86400_000) : null;
      const now = Date.now();
      const trialActive = trialEndsAt ? trialEndsAt.getTime() > now : false;
      const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86400_000))
        : null;

      const currentPeriodEnd = sub?.current_period_end
        ? new Date(sub.current_period_end as string)
        : null;
      const subActive: boolean = sub
        ? (["active", "trialing", "past_due"].includes(sub.status as string) &&
            (!currentPeriodEnd || currentPeriodEnd.getTime() > now)) ||
          (sub.status === "canceled" && !!currentPeriodEnd && currentPeriodEnd.getTime() > now)
        : false;

      let hasAccess: boolean;
      let reason: BusinessAccess["reason"];
      if (subActive) {
        hasAccess = true;
        reason = "subscribed";
      } else if (!hasBusiness) {
        hasAccess = true;
        reason = "no-business";
      } else if (trialActive) {
        hasAccess = true;
        reason = "trialing";
      } else {
        hasAccess = false;
        reason = "trial-expired";
      }

      if (cancelled) return;
      setState({
        loading: false,
        hasBusiness,
        trialEndsAt,
        trialDaysLeft,
        isSubscribed: !!subActive,
        subscriptionStatus: (sub?.status as string) ?? null,
        cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
        currentPeriodEnd,
        hasAccess,
        reason,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
