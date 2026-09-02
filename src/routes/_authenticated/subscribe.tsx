import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import {
  closePaddleCheckout,
  describePaddleCheckoutError,
  getPaddlePriceId,
  initializePaddle,
  isPaddleCheckoutError,
  subscribeToPaddleEvents,
} from "@/lib/paddle";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { PLAN_LIST, TRIAL_TIER, PLANS, formatPlanPrice, type Plan } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/subscribe")({
  head: () => ({
    meta: [
      { title: "Choose a plan — ClubCarder Business" },
      { name: "description", content: "Pick the ClubCarder plan that fits your business." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => {
    const returnTo = typeof search.returnTo === "string" ? search.returnTo : undefined;
    // Same-origin absolute paths only. `//evil.com` is a protocol-relative URL,
    // so without the second test it would send the user off-site after paying.
    return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? { returnTo }
      : {};
  },
  component: SubscribePage,
});

const TRIAL_PLAN = PLANS[TRIAL_TIER];

function SubscribePage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const access = useBusinessAccess();
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
      // A subscription covers a business. Without one there is nothing to
      // cover: they would pay immediately, get nothing until they set a
      // business up, and forfeit the 14 free days they were entitled to.
      if (!access.loading && !access.hasBusiness) {
        toast.error("Set up your business first", {
          description: "Your plan covers a business, and the first 14 days are free.",
        });
        navigate({ to: "/business/onboarding" });
        return;
      }
      // Where to land after paying. The caller states this explicitly: reading
      // it from `document.referrer` reported the last *full page load*, not the
      // route the user actually came from. After client-side navigation that is
      // stale — typically the sign-in landing page — so paying customers were
      // dropped on /wallet instead of the dashboard they had just upgraded.
      const destination = returnTo && returnTo !== "/subscribe" ? returnTo : "/business";
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
        // The tier is echoed back by the Paddle webhook so the subscription row
        // records which plan was bought.
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

  const trialing = access.reason === "trialing";

  // Going "back" to /business is only sensible if the dashboard will actually
  // let them in. Someone locked out bounces straight back here, and someone
  // with no business at all gets pushed into the onboarding wizard — neither is
  // what "back" should mean, so send both to their wallet.
  const backTo = access.hasBusiness && access.hasAccess ? "/business" : "/wallet";

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => navigate({ to: backTo })}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            ClubCarder Business
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold">
            {trialing ? "You're on the free trial" : "Choose your plan"}
          </h1>

          {!access.loading && !access.hasBusiness && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-dashed border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                These plans cover a business. Set yours up first — the first{" "}
                <strong className="text-foreground">14 days are free</strong>, so there's nothing to
                pay yet.
              </p>
              <Button className="mt-3" onClick={() => navigate({ to: "/business/onboarding" })}>
                Set up my business
              </Button>
            </div>
          )}
          {trialing && access.trialDaysLeft != null && (
            <p className="mt-2 text-sm text-muted-foreground">
              Your trial includes the <strong className="text-foreground">{TRIAL_PLAN.name}</strong>{" "}
              plan and has{" "}
              <strong className="text-foreground">
                {access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"}
              </strong>{" "}
              left. Upgrade any time for more locations, cards and team members.
            </p>
          )}
          {access.reason === "trial-expired" && (
            <p className="mt-2 text-sm text-destructive">
              Your free trial has ended. Pick a plan to keep your business active.
            </p>
          )}
          {access.reason === "needs-more-seats" && (
            <p className="mt-2 text-sm text-destructive">
              {access.businessCount} business{access.businessCount === 1 ? "" : "es"} ·{" "}
              {access.seatCount} subscription{access.seatCount === 1 ? "" : "s"}. Each business
              needs its own plan.
            </p>
          )}
          {access.reason === "no-business" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a <strong className="text-foreground">14-day free trial</strong> — no card
              required.
            </p>
          )}

          <OrnamentDivider className="my-6 w-32 mx-auto opacity-60" />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLAN_LIST.map((plan, i) => {
            const isTrialPlan = trialing && plan.tier === TRIAL_PLAN.tier;
            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`flex flex-col rounded-2xl border-2 bg-card paper-grain card-shadow p-7 ${
                  plan.popular ? "border-primary/40 ring-1 ring-primary/30" : "border-ink/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
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

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold">
                    {formatPlanPrice(plan.price)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Cancel anytime.</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.highlights.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => startCheckout(plan)}
                  disabled={loadingTier !== null}
                  variant={plan.popular ? "default" : "outline"}
                  className="mt-7 h-12 w-full text-base"
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

        {access.isSubscribed && access.uncoveredCount === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-secondary p-4 text-center text-sm">
            You're subscribed to {access.seatCount} business plan
            {access.seatCount === 1 ? "" : "s"}.{" "}
            {access.cancelAtPeriodEnd && access.currentPeriodEnd
              ? `Access continues until ${access.currentPeriodEnd.toLocaleDateString()}.`
              : "Thanks for supporting ClubCarder."}
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Billed monthly in NOK. Taxes handled at checkout.
        </p>
      </div>
    </div>
  );
}
