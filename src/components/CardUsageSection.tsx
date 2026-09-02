import type { Reward } from "@/components/StampCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
    <Accordion type="single" collapsible className={cn("rounded-2xl border border-border bg-card", className)}>
      <AccordionItem value="usage" className="border-0">
        <AccordionTrigger className="gap-3 px-4 py-4 text-sm font-semibold hover:no-underline">
          How to use this card
        </AccordionTrigger>
        <AccordionContent className="px-4">
          {milestones.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {milestones.map(({ step, label, stampsRequired }) => (
                <li key={step} className="break-words">
                  <span>{`After step ${stampsRequired} you will get voucher for`}</span>{" "}
                  <span data-i18n-ignore className="font-medium text-foreground">
                    ‘{label}’
                  </span>.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {totalSteps > 0
                ? "Collect stamps when the business scans your customer QR."
                : "This card has no stamp steps."}
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
