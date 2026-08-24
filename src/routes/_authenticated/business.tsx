import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { ScreenLoader } from "@/components/Spinner";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { motion } from "framer-motion";
import { formatPlanPrice, PLAN_LIST } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/business")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const access = useBusinessAccess();
  const navigate = useNavigate();

  if (access.loading) {
    return <ScreenLoader />;
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
      {access.reason === "trialing" && access.trialDaysLeft != null && (
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

