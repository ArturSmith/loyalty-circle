import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";

export const Route = createFileRoute("/_authenticated/subscribe")({
  head: () => ({
    meta: [
      { title: "Subscribe — Stempel Business" },
      { name: "description", content: "Unlock unlimited digital loyalty cards for your business." },
    ],
  }),
  component: SubscribePage,
});

const FEATURES = [
  "Unlimited stamp card designs",
  "Unlimited customers & stamps",
  "In-app QR scanner for staff",
  "Customer analytics & history",
  "Custom colors, logo & rewards",
  "Priority support",
];

function SubscribePage() {
  const navigate = useNavigate();
  const access = useBusinessAccess();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth", search: { redirect: "/subscribe" } });
        return;
      }
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId("business_monthly");
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: u.user.email ? { email: u.user.email } : undefined,
        customData: { userId: u.user.id },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/business?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not open checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => navigate({ to: "/business" })}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Stempel Business
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              Grow your regulars
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Beautiful digital stamp cards for your shop, café, or salon.
            </p>
            <OrnamentDivider className="my-5 w-32 mx-auto opacity-60" />
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-5xl font-semibold">$19</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            {access.reason === "trialing" && access.trialDaysLeft != null && (
              <p className="mt-2 text-xs text-muted-foreground">
                You have <strong className="text-foreground">{access.trialDaysLeft} day{access.trialDaysLeft === 1 ? "" : "s"}</strong> left in your free trial.
              </p>
            )}
            {access.reason === "trial-expired" && (
              <p className="mt-2 text-xs text-destructive">
                Your free trial has ended. Subscribe to keep your business active.
              </p>
            )}
            {access.reason === "no-business" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Start with a <strong className="text-foreground">14-day free trial</strong> — no card required.
              </p>
            )}
          </div>

          <ul className="mt-6 space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {access.isSubscribed ? (
            <div className="mt-8 rounded-lg bg-secondary p-4 text-center text-sm">
              You're subscribed. {access.cancelAtPeriodEnd && access.currentPeriodEnd
                ? `Access continues until ${access.currentPeriodEnd.toLocaleDateString()}.`
                : "Thanks for supporting Stempel."}
            </div>
          ) : access.reason === "no-business" ? (
            <Button
              onClick={() => navigate({ to: "/business" })}
              className="mt-8 w-full h-12 text-base"
            >
              Start free trial
            </Button>
          ) : (
            <Button
              onClick={startCheckout}
              disabled={loading}
              className="mt-8 w-full h-12 text-base"
            >
              {loading ? "Opening checkout…" : "Subscribe — $19/month"}
            </Button>
          )}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Cancel anytime. Billed monthly. Taxes handled at checkout.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
