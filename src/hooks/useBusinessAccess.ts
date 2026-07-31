import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export const TRIAL_DAYS = 14;

export type BusinessAccess = {
  loading: boolean;
  hasBusiness: boolean;
  /** How many businesses this account owns. */
  businessCount: number;
  /** How many active subscriptions (seats) this account holds in the current environment. */
  seatCount: number;
  /** Businesses beyond the covered seats/trial. */
  uncoveredCount: number;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  isSubscribed: boolean;
  subscriptionStatus: string | null;
  /** Card failed — Paddle is retrying. Access is kept, but the user must update payment. */
  isPastDue: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  hasAccess: boolean;
  reason:
    | "subscribed"
    | "trialing"
    | "no-business"
    | "trial-expired"
    | "needs-more-seats"
    | "loading";
  refetch: () => void;
};

const EMPTY: Omit<BusinessAccess, "refetch"> = {
  loading: true,
  hasBusiness: false,
  businessCount: 0,
  seatCount: 0,
  uncoveredCount: 0,
  trialEndsAt: null,
  trialDaysLeft: null,
  isSubscribed: false,
  subscriptionStatus: null,
  isPastDue: false,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  hasAccess: false,
  reason: "loading",
};

function isRowActive(sub: { status: string; current_period_end: string | null }, now: number) {
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  if (["active", "trialing", "past_due"].includes(sub.status)) return end === null || end > now;
  if (sub.status === "canceled") return end !== null && end > now;
  return false;
}

export function useBusinessAccess(): BusinessAccess {
  const [state, setState] = useState<Omit<BusinessAccess, "refetch">>(EMPTY);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setState({ ...EMPTY, loading: false, reason: "no-business" });
        return;
      }
      const env = getPaddleEnvironment();
      const [{ data: businesses }, { data: subs }, { data: profile }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, created_at")
          .eq("owner_id", u.user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("subscriptions")
          .select("status,current_period_end,cancel_at_period_end,created_at")
          .eq("user_id", u.user.id)
          .eq("environment", env)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("trial_started_at").eq("id", u.user.id).maybeSingle(),
      ]);

      const now = Date.now();
      const businessCount = businesses?.length ?? 0;
      const hasBusiness = businessCount > 0;

      const activeSubs = (subs ?? []).filter((s) =>
        isRowActive(s as { status: string; current_period_end: string | null }, now)
      );
      const seatCount = activeSubs.length;
      const primary = activeSubs[0] ?? subs?.[0] ?? null;

      const trialStart = (profile as { trial_started_at?: string | null } | null)?.trial_started_at;
      const trialEndsAt = trialStart
        ? new Date(new Date(trialStart).getTime() + TRIAL_DAYS * 86400_000)
        : null;
      const trialActive = trialEndsAt ? trialEndsAt.getTime() > now : false;
      const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / 86400_000))
        : null;

      // One seat covers one business (oldest first). The trial covers the first business only.
      const covered = Math.min(businessCount, seatCount + (trialActive ? 1 : 0));
      const uncoveredCount = Math.max(0, businessCount - covered);

      let hasAccess: boolean;
      let reason: BusinessAccess["reason"];
      if (!hasBusiness) {
        hasAccess = true;
        reason = "no-business";
      } else if (uncoveredCount > 0) {
        hasAccess = false;
        reason = seatCount > 0 || !trialEndsAt ? "needs-more-seats" : "trial-expired";
      } else if (seatCount > 0) {
        hasAccess = true;
        reason = "subscribed";
      } else {
        hasAccess = true;
        reason = "trialing";
      }

      if (cancelled) return;
      setState({
        loading: false,
        hasBusiness,
        businessCount,
        seatCount,
        uncoveredCount,
        trialEndsAt,
        trialDaysLeft,
        isSubscribed: seatCount > 0,
        subscriptionStatus: (primary?.status as string) ?? null,
        isPastDue: activeSubs.some((s) => s.status === "past_due"),
        cancelAtPeriodEnd: !!primary?.cancel_at_period_end,
        currentPeriodEnd: primary?.current_period_end
          ? new Date(primary.current_period_end as string)
          : null,
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
