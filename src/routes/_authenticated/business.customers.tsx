import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CheckCircle2, CreditCard, ScanLine, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/Spinner";
import { listBusinessCustomers, type BusinessCustomerSummary } from "@/utils/customers.functions";
import { shortCustomerCode } from "@/lib/customer-code";
import { initialsFrom, resolveAvatarUrls } from "@/lib/avatar";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { BackButton } from "@/components/BackButton";
import { TabScreen } from "@/components/TabScreen";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";
import { BusinessSummaryStat } from "@/components/business/BusinessSummaryStat";

export const Route = createFileRoute("/_authenticated/business/customers")({
  head: () => ({ meta: [{ title: "Customers — ClubCarder" }] }),
  // A customer QR opens this page with their id as the initial filter.
  validateSearch: z.object({ businessId: z.string().uuid(), q: z.string().optional() }),
  component: Customers,
});

function Customers() {
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="customers.view">
      <CustomersContent />
    </BusinessPermissionGate>
  );
}

function CustomersContent() {
  const navigate = useNavigate();
  const { businessId, q } = Route.useSearch();
  const fetchCustomers = useServerFn(listBusinessCustomers);
  const permissions = useBusinessPermissions(businessId);
  const [customers, setCustomers] = useState<BusinessCustomerSummary[]>([]);
  const [activeCardCount, setActiveCardCount] = useState(0);
  const [avatarUrls, setAvatarUrls] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState(q ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setQuery(q ?? ""), [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCustomers({ data: { businessId } })
      .then(async ({ customers: rows, activeCardCount: nextActiveCardCount }) => {
        if (cancelled) return;
        setCustomers(rows);
        setActiveCardCount(nextActiveCardCount);
        const resolved = await resolveAvatarUrls(rows.map((customer) => customer.avatar_url));
        if (!cancelled) setAvatarUrls(resolved);
      })
      .catch((reason) => {
        if (!cancelled) {
          setCustomers([]);
          setActiveCardCount(0);
          setError(reason instanceof Error ? reason.message : "Customers could not be loaded");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, fetchCustomers]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const code = text.replace(/[^0-9a-f]/g, "");
    if (!text) return customers;
    return customers.filter((customer) => {
      const customerCode = customer.id.replace(/-/g, "").toLowerCase();
      return (
        customer.display_name?.toLowerCase().includes(text) ||
        shortCustomerCode(customer.id).toLowerCase().includes(text) ||
        (code.length >= 6 && customerCode.startsWith(code)) ||
        customer.cards.some((card) => card.title.toLowerCase().includes(text))
      );
    });
  }, [customers, query]);

  const totals = useMemo(() => {
    const cards = customers.flatMap((customer) => customer.cards);
    return {
      customers: customers.length,
      completed: cards.filter((card) => card.completed_at !== null).length,
    };
  }, [customers]);

  return (
    <TabScreen
      title="Customers"
      subtitle="Everyone collecting loyalty rewards with this business."
      backAction={(
        <BackButton
          label="Back to business dashboard"
          onClick={() => navigate({ to: "/business", search: { businessId } })}
        />
      )}
      action={permissions.has("cards.stamp") ? (
        <Button asChild variant="outline" size="sm" className="gap-2 rounded-full">
          <Link to="/business/scan" search={{ businessId }}>
            <ScanLine className="h-4 w-4" /> Scan
          </Link>
        </Button>
      ) : undefined}
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-3xl">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium">Customers couldn’t be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <BusinessSummaryStat label="Customers" value={totals.customers} icon={Users} />
              <BusinessSummaryStat label="Active cards" value={activeCardCount} icon={CreditCard} />
              <BusinessSummaryStat label="Completed" value={totals.completed} icon={CheckCircle2} />
            </div>

            <div className="relative mt-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customer, code or loyalty card"
                aria-label="Search customers"
                className="pl-9"
              />
            </div>

            {customers.length === 0 ? (
              <EmptyCustomers businessId={businessId} canStamp={permissions.has("cards.stamp")} />
            ) : filtered.length === 0 ? (
              <div className="mt-12 text-center">
                <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No matching customers</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a name, customer code, or card name.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filtered.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    avatarUrl={customer.avatar_url ? avatarUrls.get(customer.avatar_url) ?? null : null}
                    businessId={businessId}
                    canViewActivity={permissions.has("analytics.view")}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </TabScreen>
  );
}

function CustomerRow({
  customer,
  avatarUrl,
  businessId,
  canViewActivity,
}: {
  customer: BusinessCustomerSummary;
  avatarUrl: string | null;
  businessId: string;
  canViewActivity: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsFrom(customer.display_name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold">
            {customer.display_name?.trim() || "Customer"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{shortCustomerCode(customer.id)}</span>
            <span className="mx-1.5">·</span>
            Joined {formatDate(customer.joined_at)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {customer.cards.length} {customer.cards.length === 1 ? "card" : "cards"}
        </span>
      </div>

      <div className="space-y-2 border-t border-border bg-muted/25 p-3">
        {customer.cards.map((card) => {
          const completed = card.completed_at !== null;
          const progress = card.total_steps > 0
            ? Math.min(100, Math.round((card.stamps_count / card.total_steps) * 100))
            : 0;
          const remaining = Math.max(0, card.total_steps - card.stamps_count);
          const content = (
            <>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{card.title}</p>
                    {completed && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {completed
                      ? "Reward ready"
                      : card.total_steps === 0
                        ? "No stamp target"
                        : `${remaining} ${remaining === 1 ? "stamp" : "stamps"} remaining`}
                  </p>
                </div>
                <div className="shrink-0 font-display text-lg font-bold">
                  {card.stamps_count}
                  <span className="text-xs font-medium text-muted-foreground">/{card.total_steps}</span>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${completed ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${completed ? 100 : progress}%` }}
                />
              </div>
            </>
          );
          return canViewActivity ? (
            <Link
              key={card.instance_id}
              to="/business/cards/$id/customers/$customerId"
              params={{ id: card.template_id, customerId: customer.id }}
              search={{ businessId, from: "customers" }}
              className="group block rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </Link>
          ) : (
            <div key={card.instance_id} className="rounded-2xl border border-border bg-card p-3">
              {content}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function EmptyCustomers({ businessId, canStamp }: { businessId: string; canStamp: boolean }) {
  return (
    <div className="mt-12 rounded-3xl border-2 border-dashed border-border p-8 text-center">
      <Users className="mx-auto h-9 w-9 text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-bold">No customers yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Customers appear here after adding one of this business’s loyalty cards to their wallet.
      </p>
      {canStamp && (
        <Button asChild variant="outline" className="mt-5 gap-2">
          <Link to="/business/scan" search={{ businessId }}>
            <ScanLine className="h-4 w-4" /> Scan a customer
          </Link>
        </Button>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
