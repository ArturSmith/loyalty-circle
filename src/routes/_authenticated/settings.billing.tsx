import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/Spinner";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ExternalLink, Sparkles, CreditCard, Calendar, XCircle, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { useEntitlements } from "@/hooks/useEntitlements";
import { getBillingPortalUrl, listTransactions, getInvoicePdfUrl } from "@/utils/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { reserveTab } from "@/lib/externalTab";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { formatPlanPrice } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plan — ClubCarder" },
      { name: "description", content: "Manage your ClubCarder subscription, plan, and billing." },
    ],
  }),
  component: BillingSettings,
});

type Tx = {
  id: string;
  status: string;
  billedAt: string | null;
  currency: string;
  total?: string;
  invoiceNumber: string | null;
  invoiceId: string | null;
};

function BillingSettings() {
  const navigate = useNavigate();
  const access = useBusinessAccess();
  // The plan actually bought, rather than assuming everyone is on one tier.
  const ent = useEntitlements();
  const portalFn = useServerFn(getBillingPortalUrl);
  const txFn = useServerFn(listTransactions);
  const invoiceFn = useServerFn(getInvoicePdfUrl);
  const [opening, setOpening] = useState(false);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const loadTransactions = useCallback(
    async (after?: string) => {
      const res = await txFn({ data: { environment: getPaddleEnvironment(), after } });
      const page = res as { items: Tx[]; nextCursor: string | null };
      setTxs((prev) => (after ? [...(prev ?? []), ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    },
    [txFn]
  );

  useEffect(() => {
    if (!access.isSubscribed) return;
    setTxLoading(true);
    loadTransactions()
      .catch((e) => {
        console.error(e);
        toast.error("Could not load invoice history.");
      })
      .finally(() => setTxLoading(false));
  }, [access.isSubscribed, loadTransactions]);

  const openPortal = () => {
    // Reserve the tab inside the click handler so it isn't popup-blocked.
    const tab = reserveTab();
    setOpening(true);
    portalFn({ data: { environment: getPaddleEnvironment() } })
      .then((res) => {
        if (res.overviewUrl) {
          tab.navigate(res.overviewUrl);
        } else {
          tab.cancel();
          toast.error("Could not open the billing portal.");
        }
      })
      .catch((e: any) => {
        console.error(e);
        tab.cancel();
        toast.error(e?.message ?? "Could not open the billing portal.");
      })
      .finally(() => setOpening(false));
  };

  const openInvoice = (transactionId: string) => {
    const tab = reserveTab();
    setInvoiceLoadingId(transactionId);
    invoiceFn({ data: { transactionId, environment: getPaddleEnvironment() } })
      .then((url) => tab.navigate(url))
      .catch((e: any) => {
        console.error(e);
        tab.cancel();
        toast.error(e?.message ?? "Could not open invoice.");
      })
      .finally(() => setInvoiceLoadingId(null));
  };

  const planLabel = access.isSubscribed
    ? `ClubCarder ${ent.plan.name}`
    : access.reason === "trialing"
      ? `Free trial — ${ent.plan.name}`
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
        {/* /business redirects anyone without a business into the onboarding
            wizard, so "back" would trap them there rather than return them. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate({ to: access.hasBusiness ? "/business" : "/profile" })}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-semibold">Billing & plan</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full pb-16">
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
            {access.isSubscribed && <span className="text-lg font-semibold">{formatPlanPrice(ent.plan.price)}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>}
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
              {opening ? "Opening…" : "Manage payments"}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </Button>
          ) : (
            <Link to="/subscribe" search={{ returnTo: "/settings/billing" }} className="block">
              <Button className="w-full h-12">
                <Sparkles className="h-4 w-4" />
                {access.reason === "trialing" ? "Subscribe now" : "Start subscription"}
              </Button>
            </Link>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            Payments are handled by our payment provider. Manage opens in a new tab.
          </p>
        </div>

        {access.isSubscribed && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold mb-3">Invoice history</h2>
            <div className="rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow overflow-hidden flex flex-col max-h-[60vh]">
              {txLoading && (
                <div className="p-4">
                  <Spinner size={24} className="mx-auto" />
                </div>
              )}
              {!txLoading && txs && txs.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground text-center">No invoices yet.</p>
              )}
              {!txLoading && txs && txs.length > 0 && (
                <>
                  <ul className="divide-y divide-ink/5 overflow-y-auto flex-1">
                    {txs.map((t) => {
                      const date = t.billedAt ? new Date(t.billedAt) : null;
                      const amount = t.total
                        ? formatMoney(t.total, t.currency)
                        : "—";
                      const paid = t.status === "completed" || t.status === "paid";
                      return (
                        <li key={t.id} className="flex items-center gap-3 p-4">
                          <div className="rounded-lg bg-secondary p-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {t.invoiceNumber ?? "Draft invoice"}
                              </p>
                              {!paid && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                  {t.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {date ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                              {" · "}
                              {amount}
                            </p>
                          </div>
                          {paid && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Download invoice"
                              disabled={invoiceLoadingId === t.id}
                              onClick={() => openInvoice(t.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {nextCursor && (
                    <div className="border-t border-ink/5 p-3">
                      <Button
                        variant="ghost"
                        className="w-full"
                        disabled={txLoadingMore}
                        onClick={() => {
                          setTxLoadingMore(true);
                          loadTransactions(nextCursor)
                            .catch((e) => {
                              console.error(e);
                              toast.error("Could not load more invoices.");
                            })
                            .finally(() => setTxLoadingMore(false));
                        }}
                      >
                        {txLoadingMore ? "Loading…" : "Load more invoices"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMoney(minor: string, currency: string) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return `${minor} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
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
