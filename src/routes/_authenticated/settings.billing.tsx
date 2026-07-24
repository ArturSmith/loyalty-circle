import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ExternalLink, Sparkles, CreditCard, Calendar, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { getBillingPortalUrl } from "@/utils/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { OrnamentDivider } from "@/components/OrnamentDivider";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plan — Stempel" },
      { name: "description", content: "Manage your Stempel subscription, plan, and billing." },
    ],
  }),
  component: BillingSettings,
});

function BillingSettings() {
  const navigate = useNavigate();
  const access = useBusinessAccess();
  const portalFn = useServerFn(getBillingPortalUrl);
  const [opening, setOpening] = useState(false);

  const openPortal = async () => {
    setOpening(true);
    try {
      const res = await portalFn({ data: { environment: getPaddleEnvironment() } });
      if (res.overviewUrl) window.open(res.overviewUrl, "_blank", "noopener,noreferrer");
      else toast.error("Could not open the billing portal.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not open the billing portal.");
    } finally {
      setOpening(false);
    }
  };

  const planLabel = access.isSubscribed
    ? "Stempel Business — Pro"
    : access.reason === "trialing"
      ? "Free trial"
      : "No active plan";

  const statusLabel = access.isSubscribed
    ? access.cancelAtPeriodEnd
      ? "Canceling at period end"
      : access.subscriptionStatus === "past_due"
        ? "Payment past due"
        : "Active"
    : access.reason === "trialing"
      ? `${access.trialDaysLeft ?? 0} day${(access.trialDaysLeft ?? 0) === 1 ? "" : "s"} left`
      : "Inactive";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-semibold">Billing & plan</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        <OrnamentDivider className="w-32 mx-auto opacity-60" />

        <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {planLabel}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{statusLabel}</p>
            </div>
            {access.isSubscribed && <span className="text-lg font-semibold">$19<span className="text-xs text-muted-foreground font-normal">/mo</span></span>}
          </div>

          <div className="mt-5 space-y-3 text-sm">
            {access.currentPeriodEnd && (
              <Row
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                label={access.cancelAtPeriodEnd || !access.isSubscribed ? "Access ends" : "Renews on"}
                value={access.currentPeriodEnd.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              />
            )}
            {access.reason === "trialing" && access.trialEndsAt && (
              <Row
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
                label="Trial ends"
                value={access.trialEndsAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              />
            )}
            {access.subscriptionStatus === "past_due" && (
              <Row
                icon={<XCircle className="h-4 w-4 text-destructive" />}
                label="Payment"
                value="Past due — please update your payment method"
              />
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {access.isSubscribed ? (
            <Button onClick={openPortal} disabled={opening} className="w-full h-12">
              <CreditCard className="h-4 w-4" />
              {opening ? "Opening…" : "Manage payments & invoices"}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </Button>
          ) : (
            <Link to="/subscribe" className="block">
              <Button className="w-full h-12">
                <Sparkles className="h-4 w-4" />
                {access.reason === "trialing" ? "Subscribe now" : "Start subscription"}
              </Button>
            </Link>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            Payments and invoices are handled by our payment provider. You'll be taken to a secure page in a new tab.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/5 pt-3 first:border-none first:pt-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}
