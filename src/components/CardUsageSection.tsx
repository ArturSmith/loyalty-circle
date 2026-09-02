import type { Reward } from "@/components/StampCard";
import { getCardUsageRewards } from "@/lib/card-usage";
import { cn } from "@/lib/utils";

/** Generated from the selected card; never stored as business-authored copy. */
export function CardUsageSection({
  totalSteps,
  rewards,
  className,
}: {
  totalSteps: number;
  rewards: readonly Reward[] | null | undefined;
  className?: string;
}) {
  const milestones = getCardUsageRewards(totalSteps, rewards);
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <h3 className="text-sm font-semibold">How to use this card</h3>
      {milestones.length > 0 ? (
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          {milestones.map(({ step, label, stampsRequired }) => (
            <li key={step} className="break-words">
              <span>{`Get ${stampsRequired} ${stampsRequired === 1 ? "stamp" : "stamps"} to earn present:`}</span>{" "}
              <span data-i18n-ignore className="font-medium text-foreground">
                “{label}”
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {totalSteps > 0
            ? "Collect stamps when the business scans your customer QR."
            : "This card has no stamp steps."}
        </p>
      )}
    </section>
  );
}
