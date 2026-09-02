import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { SubscriptionPlans } from "@/components/business/SubscriptionPlans";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { TRIAL_TIER, PLANS } from "@/lib/plans";

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
    return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? { returnTo } : {};
  },
  component: SubscribePage,
});

const TRIAL_PLAN = PLANS[TRIAL_TIER];

function SubscribePage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const access = useBusinessAccess();
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

        <SubscriptionPlans access={access} returnTo={returnTo} />

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
