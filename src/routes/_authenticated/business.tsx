import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ScreenLoader } from "@/components/Spinner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TRIAL_DAYS, useBusinessAccess } from "@/hooks/useBusinessAccess";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { motion } from "framer-motion";
import { formatPlanPrice, PLAN_LIST } from "@/lib/plans";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";
import { BusinessApprovalGate } from "@/components/business/BusinessApprovalGate";

export const Route = createFileRoute("/_authenticated/business")({
  component: BusinessEntry,
});

function BusinessEntry() {
  const { pathname, search } = useRouterState({ select: (state) => state.location });
  // Setup and review must remain available without an active subscription.
  if (["/business/onboarding", "/business/review"].includes(pathname.replace(/\/$/, ""))) return <Outlet />;
  const businessId = (search as { businessId?: string }).businessId;
  return <BusinessApprovalGate businessId={businessId}><BusinessLayout /></BusinessApprovalGate>;
}

function BusinessLayout() {
  const access = useBusinessAccess();
  const navigate = useNavigate();
  const selectedBusinessId = useRouterState({
    select: (state) => (state.location.search as { businessId?: string }).businessId,
  });
  const ownerCacheKey = `business-layout-owner:${selectedBusinessId ?? "default"}`;
  const restrictionCacheKey = `business-layout-restriction:${selectedBusinessId ?? "default"}`;
  const [isBusinessOwner, setIsBusinessOwner] = useState(
    () => getNavigationCache<boolean>(ownerCacheKey)?.value ?? !selectedBusinessId,
  );
  const [adminAccessRestricted, setAdminAccessRestricted] = useState<boolean | null>(
    () => getNavigationCache<boolean>(restrictionCacheKey)?.value ?? (selectedBusinessId ? null : false),
  );

  useEffect(() => {
    const cached = getNavigationCache<boolean>(ownerCacheKey);
    if (cached) setIsBusinessOwner(cached.value);
    else setIsBusinessOwner(!selectedBusinessId);
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setIsBusinessOwner(false); return; }
      if (!selectedBusinessId) {
        setNavigationCache(ownerCacheKey, true);
        setIsBusinessOwner(true);
        return;
      }
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", selectedBusinessId)
        .maybeSingle();
      const next = business?.owner_id === auth.user.id;
      setNavigationCache(ownerCacheKey, next);
      setIsBusinessOwner(next);
    })();
  }, [ownerCacheKey, selectedBusinessId]);

  useEffect(() => {
    let cancelled = false;
    const cached = getNavigationCache<boolean>(restrictionCacheKey);
    if (cached) setAdminAccessRestricted(cached.value);
    else setAdminAccessRestricted(selectedBusinessId ? null : false);
    (async () => {
      if (!selectedBusinessId) {
        if (!cancelled) {
          setNavigationCache(restrictionCacheKey, false);
          setAdminAccessRestricted(false);
        }
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (!cancelled) {
          setNavigationCache(restrictionCacheKey, false);
          setAdminAccessRestricted(false);
        }
        return;
      }
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id,trial_started_at,comped")
        .eq("id", selectedBusinessId)
        .maybeSingle();
      if (!business || business.owner_id === auth.user.id || business.comped) {
        if (!cancelled) {
          setNavigationCache(restrictionCacheKey, false);
          setAdminAccessRestricted(false);
        }
        return;
      }

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", business.owner_id)
        .eq("environment", getPaddleEnvironment());
      const now = Date.now();
      const ownerHasActiveSubscription = (subscriptions ?? []).some((subscription) => {
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end).getTime()
          : null;
        return ["active", "trialing", "past_due"].includes(subscription.status) &&
          (periodEnd === null || periodEnd > now);
      });
      const trialEndsAt = business.trial_started_at
        ? new Date(business.trial_started_at).getTime() + TRIAL_DAYS * 86400_000
        : 0;
      if (!cancelled) {
        const next = !ownerHasActiveSubscription && trialEndsAt <= now;
        setNavigationCache(restrictionCacheKey, next);
        setAdminAccessRestricted(next);
      }
    })();
    return () => { cancelled = true; };
  }, [restrictionCacheKey, selectedBusinessId]);

  if (access.loading || adminAccessRestricted === null) {
    return <ScreenLoader />;
  }

  if (adminAccessRestricted) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border-2 border-ink/10 bg-card p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Business access restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The business owner’s free trial has ended and there is no active subscription for this business.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Please contact the business manager to restore access.
          </p>
          <Button onClick={() => navigate({ to: "/workspace" })} variant="outline" className="mt-6 w-full">
            Back to workspace
          </Button>
        </div>
      </div>
    );
  }

  if (!access.hasAccess) {
    const needsSeats = access.reason === "needs-more-seats";
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8 text-center"
          >
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">
              {needsSeats ? "Add a subscription for this business" : "Your free trial has ended"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {needsSeats
                ? `Each business needs its own subscription. You have ${access.businessCount} business${access.businessCount === 1 ? "" : "es"} and ${access.seatCount} subscription${access.seatCount === 1 ? "" : "s"}.`
                : "Subscribe to keep issuing stamps, adding customers, and running your loyalty program."}
            </p>
            <OrnamentDivider className="my-5 w-32 mx-auto opacity-60" />
            {/* Quoting one price here misrepresented the offer as single-tier.
                Show the entry price and let /subscribe present the full range. */}
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Plans from</p>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="font-display text-4xl font-semibold">
                {formatPlanPrice(PLAN_LIST[0].price)}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {PLAN_LIST.length} plans · cancel anytime
            </p>
            <Button
              onClick={() => navigate({ to: "/subscribe" })}
              className="mt-6 w-full h-12 text-base"
            >
              <Sparkles className="h-4 w-4" />
              {needsSeats ? "Add subscription" : "See plans"}
            </Button>
            <button
              onClick={() => navigate({ to: "/wallet" })}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Back to my wallet
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <>
      {access.isPastDue && (
        <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-center text-xs text-destructive">
          <strong>Payment failed.</strong> Update your card to avoid losing access.{" "}
          <button
            onClick={() => navigate({ to: "/settings/billing" })}
            className="font-medium underline underline-offset-2"
          >
            Update payment method
          </button>
        </div>
      )}
      {isBusinessOwner && access.reason === "trialing" && access.trialDaysLeft != null && (
        <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-xs">
          <span className="text-foreground">
            Free trial: <strong>{access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"} left</strong>
          </span>
          <button
            onClick={() => navigate({ to: "/subscribe" })}
            className="ml-2 font-medium text-primary underline underline-offset-2"
          >
            Subscribe
          </button>
        </div>
      )}
      {access.isSubscribed && access.cancelAtPeriodEnd && access.currentPeriodEnd && (
        <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs text-amber-900">
          Subscription ends {access.currentPeriodEnd.toLocaleDateString()}.{" "}
          <button
            onClick={() => navigate({ to: "/subscribe" })}
            className="font-medium underline underline-offset-2"
          >
            Manage
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}
