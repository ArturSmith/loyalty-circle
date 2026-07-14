import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/business")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const access = useBusinessAccess();
  const navigate = useNavigate();

  if (access.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!access.hasAccess) {
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
              Your free trial has ended
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Subscribe to keep issuing stamps, adding customers, and running your loyalty program.
            </p>
            <OrnamentDivider className="my-5 w-32 mx-auto opacity-60" />
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-4xl font-semibold">$19</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <Button
              onClick={() => navigate({ to: "/subscribe" })}
              className="mt-6 w-full h-12 text-base"
            >
              <Sparkles className="h-4 w-4" />
              Subscribe now
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
