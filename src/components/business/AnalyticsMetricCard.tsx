import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { percentChange } from "@/lib/business-analytics";

export function AnalyticsMetricCard({
  icon: Icon,
  label,
  value,
  previous,
  comparison = true,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  previous: number;
  comparison?: boolean;
  description?: string;
}) {
  const change = comparison ? percentChange(value, previous) : null;
  const positive = change !== null && change > 0;
  const negative = change !== null && change < 0;
  const ChangeIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {comparison ? (
          change === null ? (
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
              New activity
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                positive
                  ? "bg-emerald-500/10 text-emerald-700"
                  : negative
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-muted text-muted-foreground"
              }`}
              aria-label={`${change > 0 ? "Up" : change < 0 ? "Down" : "No change"} ${Math.abs(change)} percent from the previous period`}
            >
              <ChangeIcon className="h-3 w-3" aria-hidden="true" />
              {Math.abs(change)}%
            </span>
          )
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none">{value.toLocaleString()}</p>
      <h3 className="mt-2 text-sm font-semibold">{label}</h3>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </article>
  );
}
