import { useMemo } from "react";
import { motion } from "framer-motion";
import { Repeat, Sparkles, Ticket, TrendingUp, Wallet, Zap } from "lucide-react";

export type AnalyticsInstance = {
  id: string;
  customer_id: string;
  stamps_count: number;
  completed_at: string | null;
  created_at: string;
};
export type AnalyticsStamp = { card_instance_id: string; created_at: string };
export type AnalyticsVoucher = {
  id: string;
  customer_id: string | null;
  status: "unused" | "used";
  created_at: string;
  redeemed_at: string | null;
};

export type AnalyticsPassEvent = {
  card_instance_id: string;
  platform: "google" | "apple";
  event: "created" | "saved" | "deleted";
  created_at: string;
};

type Props = {
  totalSteps: number;
  instances: AnalyticsInstance[];
  stamps: AnalyticsStamp[];
  vouchers?: AnalyticsVoucher[];
  passEvents?: AnalyticsPassEvent[];
};

const WEEK = 7 * 86400_000;

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function CardAnalytics({ totalSteps, instances, stamps, vouchers = [], passEvents = [] }: Props) {
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

    // Vouchers: issued when a reward step unlocks, outstanding until redeemed.
    const issued = vouchers.length;
    const redeemed = vouchers.filter((v) => v.status === "used").length;
    const outstanding = issued - redeemed;
    const holders = new Set(
      vouchers.filter((v) => v.status === "unused" && v.customer_id).map((v) => v.customer_id),
    ).size;

    // How long customers take to come in and claim their reward.
    const redeemDays = vouchers
      .filter((v) => v.status === "used" && v.redeemed_at)
      .map((v) => (new Date(v.redeemed_at!).getTime() - new Date(v.created_at).getTime()) / 86400_000)
      .filter((d) => d >= 0);
    const avgRedeemDays = redeemDays.length
      ? redeemDays.reduce((a, b) => a + b, 0) / redeemDays.length
      : null;

    // Outstanding vouchers that have been sitting unclaimed for over a month.
    const staleVouchers = vouchers.filter(
      (v) => v.status === "unused" && now - new Date(v.created_at).getTime() > 30 * 86400_000,
    ).length;

    return {
      claimed, activated, repeat, halfway, completed, active30, returnVisits,
      weeks, weekPeak, trend, distribution, distPeak, avgStamps, totalStamps: stamps.length,
      issued, redeemed, outstanding, holders, avgRedeemDays, staleVouchers,
    };
  }, [instances, stamps, vouchers, totalSteps]);

  // Phone-wallet passes. Apple and Google only ever tell us "saved" or
  // "removed" — never who, and never that a pass was opened.
  const wallet = useMemo(() => {
    const passesCreated = passEvents.filter((e) => e.event === "created").length;
    const savedIds = new Set(
      passEvents.filter((e) => e.event === "saved").map((e) => e.card_instance_id),
    );
    const deletedIds = new Set(
      passEvents.filter((e) => e.event === "deleted").map((e) => e.card_instance_id),
    );
    let stillInstalled = 0;
    savedIds.forEach((id) => {
      if (!deletedIds.has(id)) stillInstalled += 1;
    });
    return {
      passesCreated,
      saved: savedIds.size,
      removed: deletedIds.size,
      stillInstalled,
      any: passEvents.length > 0,
    };
  }, [passEvents]);

  const completionRate = pct(m.completed, m.claimed);
  const repeatRate = pct(m.repeat, m.claimed);
  const redemptionRate = pct(m.redeemed, m.issued);

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
        <ValueTile icon={Sparkles} value={m.issued} label="Rewards unlocked" />
      </div>

      {wallet.any ? (
        <div className="mt-3 rounded-2xl border-2 border-ink/10 bg-card p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Apple &amp; Google Wallet</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <VoucherStat value={wallet.passesCreated} label="Passes created" />
            <VoucherStat value={wallet.saved} label="Saved to phone" />
            <VoucherStat value={wallet.stillInstalled} label="Still installed" tone="emerald" />
            <VoucherStat value={wallet.removed} label="Removed" tone="amber" />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Apple and Google only report saves and removals — never who saved a
            pass, or when it was opened.
          </p>
        </div>
      ) : null}

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

      {/* Vouchers */}
      {m.issued > 0 && (
        <div className="mt-3 rounded-2xl border-2 border-ink/10 bg-card p-5">
          <div className="flex items-baseline justify-between">
            <div className="font-medium">Vouchers</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Rewards</div>
          </div>

          <div className="mt-4 flex items-center gap-5">
            <Ring value={redemptionRate} />
            <div className="min-w-0">
              <div className="font-medium">Redemption rate</div>
              <p className="text-xs text-muted-foreground mt-1">
                {m.redeemed} of {m.issued} unlocked rewards have been claimed in store.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <VoucherStat value={m.issued} label="Issued" />
            <VoucherStat value={m.outstanding} label="Outstanding" tone="amber" />
            <VoucherStat value={m.redeemed} label="Redeemed" tone="emerald" />
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {m.outstanding > 0 && (
              <p className="flex items-start gap-1.5">
                <Ticket className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="font-medium text-foreground">{m.holders}</strong>{" "}
                  {m.holders === 1 ? "customer is" : "customers are"} holding{" "}
                  {m.outstanding === 1 ? "a voucher" : `${m.outstanding} vouchers`} — that's{" "}
                  {m.outstanding === 1 ? "a visit" : "visits"} you can still expect.
                </span>
              </p>
            )}
            {m.avgRedeemDays !== null && (
              <p>
                Customers claim their reward{" "}
                <strong className="font-medium text-foreground">
                  {m.avgRedeemDays < 1 ? "the same day" : `after ~${m.avgRedeemDays.toFixed(1)} days`}
                </strong>{" "}
                on average.
              </p>
            )}
            {m.staleVouchers > 0 && (
              <p>
                {m.staleVouchers} {m.staleVouchers === 1 ? "voucher has" : "vouchers have"} been
                unclaimed for over a month — worth a reminder.
              </p>
            )}
          </div>
        </div>
      )}

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
          <div className="mt-5 flex h-28 items-stretch gap-2">
            {m.weeks.map((w, i) => (
              <div key={i} className="flex-1 flex h-full flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] text-muted-foreground">{w.count || ""}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: Math.max(4, (w.count / m.weekPeak) * 80) }}
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
          <div className="mt-5 flex h-28 items-stretch gap-1">
            {m.distribution.map((d) => (
              <div key={d.step} className="flex-1 flex h-full flex-col items-center justify-end gap-1.5" title={`${d.count} at ${d.step} stamps`}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: Math.max(3, (d.count / m.distPeak) * 92) }}
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

function VoucherStat({
  value, label, tone,
}: { value: number; label: string; tone?: "amber" | "emerald" }) {
  const toneClass =
    tone === "amber" ? "text-amber-600"
    : tone === "emerald" ? "text-emerald-600"
    : "";
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-secondary/40 p-3 text-center">
      <div className={`font-display text-2xl leading-none ${toneClass}`}>{value}</div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
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
