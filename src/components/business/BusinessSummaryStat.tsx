import type { LucideIcon } from "lucide-react";

/** Shared presentation for the basic business metrics shown across dashboards. */
export function BusinessSummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
      <Icon className="mx-auto h-4 w-4 text-primary" aria-hidden="true" />
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
