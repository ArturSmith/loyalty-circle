import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  Gift,
  History,
  RefreshCcw,
  Sparkles,
  Stamp,
  TicketCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { TabScreen } from "@/components/TabScreen";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { AnalyticsMetricCard } from "@/components/business/AnalyticsMetricCard";
import {
  ANALYTICS_RANGES,
  emptyBusinessAnalytics,
  parseBusinessAnalytics,
  percentChange,
  type AnalyticsRange,
  type BusinessAnalytics,
} from "@/lib/business-analytics";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";
import { useLanguage } from "@/i18n";

type AnalyticsLoadError = {
  title: string;
  message: string;
};

function describeAnalyticsError(reason: unknown): AnalyticsLoadError {
  const candidate = reason as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";

  if (code === "PGRST202" || message.includes("get_business_value_analytics")) {
    return {
      title: "Analytics setup required",
      message: "The analytics database update has not been installed yet.",
    };
  }

  return {
    title: "Analytics couldn’t be loaded",
    message: message || "Please check your connection and try again.",
  };
}

const searchSchema = z.object({
  businessId: z.string().uuid(),
  range: z.coerce
    .number()
    .refine((value) => ANALYTICS_RANGES.includes(value as AnalyticsRange))
    .optional(),
});

export const Route = createFileRoute("/_authenticated/business/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ClubCarder" }] }),
  validateSearch: searchSchema,
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="analytics.view">
      <AnalyticsScreen />
    </BusinessPermissionGate>
  );
}

function AnalyticsScreen() {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const { businessId, range: searchRange } = Route.useSearch();
  const range = (searchRange ?? 30) as AnalyticsRange;
  const cacheKey = `business-analytics:${businessId}:${range}`;
  const cached = getNavigationCache<BusinessAnalytics>(cacheKey);
  const [analytics, setAnalytics] = useState<BusinessAnalytics>(
    () => cached?.value ?? emptyBusinessAnalytics(range),
  );
  const [loading, setLoading] = useState(() => cached === null);
  const [error, setError] = useState<AnalyticsLoadError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const snapshot = getNavigationCache<BusinessAnalytics>(cacheKey);
    if (snapshot) {
      setAnalytics(snapshot.value);
      setLoading(false);
    } else {
      setAnalytics(emptyBusinessAnalytics(range));
      setLoading(true);
    }
    setError(null);

    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_business_value_analytics", {
          _business_id: businessId,
          _range_days: range,
        });
        if (rpcError) throw rpcError;
        if (cancelled) return;
        const parsed = parseBusinessAnalytics(data, range);
        setAnalytics(parsed);
        setNavigationCache(cacheKey, parsed);
      } catch (reason) {
        if (!cancelled && !snapshot) {
          setError(describeAnalyticsError(reason));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId, cacheKey, range, reloadToken]);

  const periodLabel = range === 0 ? "all time" : `the last ${range} days`;

  return (
    <TabScreen
      title="Analytics"
      subtitle="What your loyalty programs bring back to the business."
      backAction={
        <BackButton
          label="Back to business dashboard"
          onClick={() => navigate({ to: "/business", search: { businessId } })}
        />
      }
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-3xl">
        <RangeSelector
          value={range}
          onChange={(next) =>
            navigate({
              to: "/business/analytics",
              search: { businessId, range: next === 30 ? undefined : next },
              replace: true,
            })
          }
        />

        {loading ? (
          <PageLoader />
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium">{error.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
            <Button
              className="mt-4 rounded-full"
              variant="outline"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            <section className="mt-6">
              <div className="grid grid-cols-2 gap-3">
                <AnalyticsMetricCard
                  icon={Users}
                  label="Active customers"
                  value={analytics.current.activeCustomers}
                  previous={analytics.previous.activeCustomers}
                  comparison={range !== 0}
                  description="Customers who received a stamp."
                />
                <AnalyticsMetricCard
                  icon={RefreshCcw}
                  label="Return visits"
                  value={analytics.current.returnVisits}
                  previous={analytics.previous.returnVisits}
                  comparison={range !== 0}
                  description="Recorded visits after a customer’s first stamp."
                />
                <AnalyticsMetricCard
                  icon={UserPlus}
                  label="New customers"
                  value={analytics.current.newCustomers}
                  previous={analytics.previous.newCustomers}
                  comparison={range !== 0}
                  description="First loyalty activity with this business."
                />
                <AnalyticsMetricCard
                  icon={TicketCheck}
                  label="Rewards redeemed"
                  value={analytics.current.rewardsRedeemed}
                  previous={analytics.previous.rewardsRedeemed}
                  comparison={range !== 0}
                  description="Rewards customers claimed in store."
                />
              </div>
            </section>

            <InsightSection analytics={analytics} businessId={businessId} range={range} />
            <ActivityChart analytics={analytics} locale={locale} periodLabel={periodLabel} />
            <JourneyFunnel analytics={analytics} periodLabel={periodLabel} />
            <CardComparison analytics={analytics} businessId={businessId} range={range} />

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              A stamp represents a recorded loyalty visit. Revenue and purchases are not estimated
              without POS data.
            </p>
          </>
        )}
      </div>
    </TabScreen>
  );
}

function RangeSelector({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
}) {
  return (
    <div
      className="grid grid-cols-4 rounded-2xl border border-border bg-card p-1 shadow-sm"
      role="group"
      aria-label="Analytics period"
    >
      {ANALYTICS_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={`min-h-10 rounded-xl px-2 text-xs font-semibold transition-colors ${
            value === range
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {range === 0 ? "All" : `${range}d`}
        </button>
      ))}
    </div>
  );
}

function InsightSection({
  analytics,
  businessId,
  range,
}: {
  analytics: BusinessAnalytics;
  businessId: string;
  range: AnalyticsRange;
}) {
  const returnChange =
    range === 0
      ? null
      : percentChange(analytics.current.returnVisits, analytics.previous.returnVisits);
  const insights = [
    analytics.insights.nearRewardCustomers > 0
      ? {
          icon: Sparkles,
          title: `${analytics.insights.nearRewardCustomers} ${analytics.insights.nearRewardCustomers === 1 ? "customer is" : "customers are"} close to a reward`,
          text: "They need only one or two more stamps.",
          tone: "primary",
        }
      : null,
    analytics.insights.staleRewards > 0
      ? {
          icon: Gift,
          title: `${analytics.insights.staleRewards} ${analytics.insights.staleRewards === 1 ? "reward has" : "rewards have"} waited over 30 days`,
          text: "A reminder could turn these into return visits.",
          tone: "amber",
        }
      : null,
    analytics.insights.inactiveCustomers > 0
      ? {
          icon: History,
          title: `${analytics.insights.inactiveCustomers} inactive ${analytics.insights.inactiveCustomers === 1 ? "customer" : "customers"}`,
          text: "They have stamped before, but not during the last 30 days.",
          tone: "muted",
        }
      : null,
    returnChange !== null && returnChange <= -10
      ? {
          icon: TrendingUp,
          title: `Return visits are down ${Math.abs(returnChange)}%`,
          text: "Compared with the previous equal period.",
          tone: "amber",
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 3) as Array<{
    icon: typeof Sparkles;
    title: string;
    text: string;
    tone: string;
  }>;

  if (insights.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Needs attention</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Useful opportunities from your current customer activity.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full">
          <Link to="/business/customers" search={{ businessId }}>
            Customers <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {insights.map(({ icon: Icon, title, text, tone }) => (
          <article
            key={title}
            className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                tone === "amber"
                  ? "bg-amber-500/10 text-amber-700"
                  : tone === "primary"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityChart({
  analytics,
  locale,
  periodLabel,
}: {
  analytics: BusinessAnalytics;
  locale: string;
  periodLabel: string;
}) {
  const max = Math.max(1, ...analytics.timeline.map((point) => point.stamps));
  return (
    <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-display text-xl font-bold">Recorded visits</h2>
        <p className="mt-1 text-xs text-muted-foreground">Stamp activity across {periodLabel}.</p>
      </div>
      {analytics.timeline.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No stamp activity yet.</p>
      ) : (
        <div className="mt-6 flex h-44 items-end gap-1.5" aria-label="Recorded visits chart">
          {analytics.timeline.map((point, index) => {
            const date = new Date(point.start);
            const label = new Intl.DateTimeFormat(locale, {
              month: "short",
              day: analytics.rangeDays === 7 ? "numeric" : undefined,
            }).format(date);
            return (
              <div
                key={point.start}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                title={`${point.stamps} recorded visits, ${point.activeCustomers} active customers`}
              >
                <span className="text-[10px] font-semibold text-foreground">
                  {point.stamps || ""}
                </span>
                <div
                  className={`w-full min-w-1 rounded-t-lg ${index === analytics.timeline.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                  style={{ height: `${Math.max(4, (point.stamps / max) * 112)}px` }}
                />
                <span className="max-w-full truncate text-[9px] text-muted-foreground">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
        <span className="text-muted-foreground">Total stamps</span>
        <strong>{analytics.current.stamps.toLocaleString()}</strong>
      </div>
    </section>
  );
}

function JourneyFunnel({
  analytics,
  periodLabel,
}: {
  analytics: BusinessAnalytics;
  periodLabel: string;
}) {
  const rows = [
    ["Joined a program", analytics.funnel.joined],
    ["Received first stamp", analytics.funnel.activated],
    ["Returned again", analytics.funnel.returned],
    ["Unlocked a reward", analytics.funnel.rewarded],
    ["Redeemed a reward", analytics.funnel.redeemed],
  ] as const;
  const total = analytics.funnel.joined;

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-xl font-bold">Customer journey</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Current progress of customers who joined during {periodLabel}.
      </p>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No new customers in this period.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map(([label, value]) => {
            const percentage = total ? Math.round((value / total) * 100) : 0;
            return (
              <div key={label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <strong>
                    {value}{" "}
                    <span className="font-normal text-muted-foreground">({percentage}%)</span>
                  </strong>
                </div>
                <Progress value={percentage} className="h-2.5 bg-ink/8" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CardComparison({
  analytics,
  businessId,
  range,
}: {
  analytics: BusinessAnalytics;
  businessId: string;
  range: AnalyticsRange;
}) {
  const cards = useMemo(
    () => analytics.cards.filter((card) => card.active || card.stamps > 0),
    [analytics.cards],
  );
  if (cards.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">Loyalty cards</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Compare which programs are creating repeat activity.
      </p>
      <div className="mt-3 space-y-3">
        {cards.map((card) => {
          const change = range === 0 ? null : percentChange(card.stamps, card.previousStamps);
          return (
            <Link
              key={card.id}
              to="/business/cards/$id"
              params={{ id: card.id }}
              search={{ businessId }}
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display font-bold">{card.title}</h3>
                    {!card.active ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.activeCustomers} active · {card.returnVisits} return visits ·{" "}
                    {card.rewardsRedeemed} rewards redeemed
                  </p>
                </div>
                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <SmallStat label="Stamps" value={card.stamps} />
                <SmallStat label="Return rate" value={`${card.returnRate}%`} />
                <SmallStat
                  label="Trend"
                  value={
                    change === null
                      ? card.stamps > 0
                        ? "New"
                        : "—"
                      : `${change > 0 ? "+" : ""}${change}%`
                  }
                  tone={
                    change !== null && change < 0
                      ? "amber"
                      : change !== null && change > 0
                        ? "green"
                        : undefined
                  }
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SmallStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "amber" | "green";
}) {
  return (
    <div>
      <p
        className={`font-display text-lg font-bold ${tone === "amber" ? "text-amber-700" : tone === "green" ? "text-emerald-700" : ""}`}
      >
        {value}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
