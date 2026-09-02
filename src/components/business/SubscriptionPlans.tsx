import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BusinessAccess } from "@/hooks/useBusinessAccess";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LIST, TRIAL_TIER, formatPlanPrice, type Plan } from "@/lib/plans";
import {
  closePaddleCheckout,
  describePaddleCheckoutError,
  getPaddlePriceId,
  initializePaddle,
  isPaddleCheckoutError,
  subscribeToPaddleEvents,
} from "@/lib/paddle";

/** Shared by the subscription page and the expired-trial/business access gate. */
export function SubscriptionPlans({
  access,
  returnTo = "/business",
}: {
  access: BusinessAccess;
  returnTo?: string;
}) {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeToPaddleEvents((event) => {
        if (!isPaddleCheckoutError(event)) return;
        console.error("Paddle checkout error", event);
        if (event.name === "checkout.error") closePaddleCheckout();
        toast.error("Checkout could not be loaded", {
          description: describePaddleCheckoutError(event),
        });
        setLoadingTier(null);
      }),
    [],
  );

  const startCheckout = async (plan: Plan) => {
    setLoadingTier(plan.tier);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth", search: { redirect: "/subscribe" } });
        return;
      }
      if (!access.hasBusiness) {
        toast.error("Set up your business first", {
          description: "Your plan covers a business, and the first 14 days are free.",
        });
        navigate({ to: "/business/onboarding" });
        return;
      }
      // Retain the selected business across the checkout-success redirect.
      // Only same-origin paths are allowed; do not trust an external return URL.
      const destination =
        returnTo.startsWith("/") && !returnTo.startsWith("//") && returnTo !== "/subscribe"
          ? returnTo
          : "/business";
      try {
        sessionStorage.setItem("post_checkout_return", destination);
      } catch {
        // Private-mode storage failure: /checkout/success falls back to /business.
      }
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(plan.tier);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: u.user.email ? { email: u.user.email } : undefined,
        customData: { userId: u.user.id, planTier: plan.tier },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e) {
      console.error(e);
      toast.error(`Could not open checkout for ${plan.name}.`, {
        description:
          e instanceof Error && e.message
            ? e.message
            : "Please try again, or contact support if it keeps happening.",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 md:gap-6">
      {PLAN_LIST.map((plan, i) => {
        const isTrialPlan = access.reason === "trialing" && plan.tier === TRIAL_TIER;
        return (
          <motion.div
            key={plan.tier}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex min-w-0 flex-col rounded-2xl border-2 bg-card paper-grain card-shadow p-5 text-left sm:p-7 ${
              plan.popular ? "border-primary/40 ring-1 ring-primary/30" : "border-ink/10"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
              {isTrialPlan ? (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  In your trial
                </span>
              ) : plan.popular ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Popular
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-5 flex flex-wrap items-baseline gap-1">
              <span className="font-display text-4xl font-semibold">
                {formatPlanPrice(plan.price)}
              </span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cancel anytime.</p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.highlights.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => startCheckout(plan)}
              disabled={access.loading || loadingTier !== null}
              variant={plan.popular ? "default" : "outline"}
              className="mt-7 min-h-12 w-full whitespace-normal text-base"
            >
              {loadingTier === plan.tier
                ? "Opening checkout…"
                : access.seatCount > 0
                  ? `Add ${plan.name}`
                  : `Choose ${plan.name}`}
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}
