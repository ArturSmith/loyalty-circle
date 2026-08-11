import { useMemo } from "react";
import { motion } from "framer-motion";
import { Repeat, Sparkles, TrendingUp, Zap } from "lucide-react";

export type AnalyticsInstance = {
  id: string;
  customer_id: string;
  stamps_count: number;
  completed_at: string | null;
  created_at: string;
};
export type AnalyticsStamp = { card_instance_id: string; created_at: string };

type Props = {
  totalSteps: number;
  instances: AnalyticsInstance[];
  stamps: AnalyticsStamp[];
};

const WEEK = 7 * 86400_000;

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function CardAnalytics({ totalSteps, instances, stamps }: Props) {
  const m = useMemo(() => {
    const now = Date.now();
    const perInstance = new Map<string, number>();
    for (const s of stamps) perInstance.set(s.card_instance_id, (perInstance.get(s.card_instance_id) ?? 0) + 1);

    const claimed = instances.length;
    const activated = instances.filter((i) => (perInstance.get(i.id) ?? i.stamps_count) > 0).length;
    const repeat = instances.filter((i) => (perInstance.get(i.id) ?? i.stamps_count) > 1).length;
    const halfway = instances.filter((i) => i.stamps_count >= Math.ceil(totalSteps / 2)).length;
    const completed = instances.filter((i) => i.completed_at).length;

    const active30 = new Set(
      stamps.filter((s) => now - new Date(s.created_at).getTime() < 30 * 86400_000).map((s) => s.card_instance_id),
    ).size;

    // Visits beyond the very first one — the traffic the card brought back.
    const returnVisits = Math.max(0, stamps.length - activated);

    // Last 8 weeks of stamping activity.
    const weeks = Array.from({ length: 8 }, (_, idx) => {
      const end = now - idx * WEEK;
      const start = end - WEEK;
      const count = stamps.filter((s) => {
        const t = new Date(s.created_at).getTime();
        return t > start && t <= end;
      }).length;
      return { count, label: idx === 0 ? "now" : `-${idx}w` };
    }).reverse();
    const weekPeak = Math.max(1, ...weeks.map((w) => w.count));
    const thisWeek = weeks[weeks.length - 1]?.count ?? 0;
    const lastWeek = weeks[weeks.length - 2]?.count ?? 0;
    const trend = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

    // How far along everybody is.
    const distribution = Array.from({ length: totalSteps + 1 }, (_, step) => ({
      step,
      count: instances.filter((i) => i.stamps_count === step).length,
    }));
    const distPeak = Math.max(1, ...distribution.map((d) => d.count));

    const avgStamps = claimed ? stamps.length / claimed : 0;

    return {
      claimed, activated, repeat, halfway, completed, active30, returnVisits,
      weeks, weekPeak, trend, distribution, distPeak, avgStamps, totalStamps: stamps.length,
    };
  }, [instances, stamps, totalSteps]);

  const completionRate = pct(m.completed, m.claimed);
  const repeatRate = pct(m.repeat, m.claimed);

  if (m.claimed === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">Performance</h2>
      <p className="text-xs text-muted-foreground mt-1">What this card is doing for your business.</p>

      {/* Headline value tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ValueTile icon={Repeat} value={m.returnVisits} label="Return visits driven" tone="primary" />
        <ValueTile icon={Zap} value={m.active30} label="Active last 30 days" />
        <ValueTile icon={TrendingUp} value={`${m.avgStamps.toFixed(1)}`} label="Avg stamps / customer" />
        <ValueTile icon={Sparkles} value={m.completed} label="Rewards earned" />
      </div>

      {/* Conversion rings */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5 flex items-center gap-5">
          <Ring value={completionRate} />
          <div className="min-w-0">
            <div className="font-medium">Completion rate</div>
            <p className="text-xs text-muted-foreground mt-1">
              {m.completed} of {m.claimed} customers finished the full card.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5 flex items-center gap-5">
          <Ring value={repeatRate} muted />
          <div className="min-w-0">
            <div className="font-medium">Come-back rate</div>
            <p className="text-xs text-muted-foreground mt-1">
              {m.repeat} of {m.claimed} customers returned for a second stamp or more.
            </p>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="mt-3 rounded-2xl border-2 border-ink/10 bg-card p-5">
        <div className="flex items-baseline justify-between">
          <div className="font-medium">Customer journey</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Funnel</div>
        </div>
        <div className="mt-4 space-y-2">
          <FunnelRow label="Claimed the card" value={m.claimed} total={m.claimed} />
          <FunnelRow label="Got first stamp" value={m.activated} total={m.claimed} />
          <FunnelRow label="Came back again" value={m.repeat} total={m.claimed} />
          <FunnelRow label="Reached halfway" value={m.halfway} total={m.claimed} />
          <FunnelRow label="Completed & rewarded" value={m.completed} total={m.claimed} highlight />
        </div>
      </div>

      {/* Activity + distribution */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5">
          <div className="flex items-baseline justify-between">
            <div className="font-medium">Stamps per week</div>
            <span
              className={`text-xs font-semibold ${m.trend >= 0 ? "text-emerald-600" : "text-destructive"}`}
            >
              {m.trend >= 0 ? "+" : ""}{m.trend}%
            </span>
          </div>
          <div className="mt-5 flex h-28 items-end gap-2">
            {m.weeks.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{w.count || ""}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (w.count / m.weekPeak) * 100)}%` }}
                  transition={{ delay: i * 0.05, type: "spring", damping: 18, stiffness: 180 }}
                  className={`w-full rounded-md ${i === m.weeks.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                />
                <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-ink/10 bg-card p-5">
          <div className="flex items-baseline justify-between">
            <div className="font-medium">Where customers are</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">By step</div>
          </div>
          <div className="mt-5 flex h-28 items-end gap-1">
            {m.distribution.map((d) => (
              <div key={d.step} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.count} at ${d.step} stamps`}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(3, (d.count / m.distPeak) * 100)}%` }}
                  transition={{ delay: d.step * 0.03, type: "spring", damping: 18, stiffness: 180 }}
                  className={`w-full rounded-sm ${d.step === totalSteps ? "bg-emerald-500" : "bg-ink/20"}`}
                />
                <span className="text-[9px] text-muted-foreground">
                  {totalSteps <= 12 || d.step % 5 === 0 ? d.step : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Each bar is how many customers sit on that stamp count.
          </p>
        </div>
      </div>
    </section>
  );
}

function ValueTile({
  icon: Icon, value, label, tone,
}: { icon: typeof Repeat; value: number | string; label: string; tone?: "primary" }) {
  return (
    <div className={`rounded-2xl border-2 p-4 ${tone === "primary" ? "border-primary/30 bg-primary/5" : "border-ink/10 bg-card"}`}>
      <Icon className={`h-4 w-4 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      <div className="mt-2 font-display text-2xl leading-none">{value}</div>
      <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

function Ring({ value, muted }: { value: number; muted?: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} className="stroke-ink/10" strokeWidth="8" fill="none" />
        <motion.circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className={muted ? "stroke-ink/60" : "stroke-primary"}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display text-lg">{value}%</div>
    </div>
  );
}

function FunnelRow({ label, value, total, highlight }: { label: string; value: number; total: number; highlight?: boolean }) {
  const width = total ? Math.max(4, (value / total) * 100) : 4;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value} <span className="text-muted-foreground">({pct(value, total)}%)</span></span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-ink/8 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 150 }}
          className={`h-full rounded-full ${highlight ? "bg-emerald-500" : "bg-primary"}`}
        />
      </div>
    </div>
  );
}
