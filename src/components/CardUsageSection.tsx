import type { Reward } from "@/components/StampCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getCardUsageRewards } from "@/lib/card-usage";
import { cn } from "@/lib/utils";

/** Approved AI instructions, with calculated milestones for cards without an AI draft. */
export function CardUsageSection({
  totalSteps,
  rewards,
  instructions,
  open,
  onOpenChange,
  className,
}: {
  totalSteps: number;
  rewards: readonly Reward[] | null | undefined;
  instructions?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const milestones = getCardUsageRewards(totalSteps, rewards);
  return (
    <Accordion type="single" collapsible
      {...(open === undefined ? {} : { value: open ? "usage" : "" })}
      onValueChange={onOpenChange ? (value) => onOpenChange(value === "usage") : undefined}
      className={cn("rounded-2xl border border-border bg-card", className)}>
      <AccordionItem value="usage" className="border-0">
        <AccordionTrigger className="gap-3 px-4 py-4 text-sm font-semibold hover:no-underline">
          How to use this card
        </AccordionTrigger>
        <AccordionContent className="px-4">
          {instructions?.trim() ? (
            <p data-i18n-ignore className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {instructions.trim()}
            </p>
          ) : milestones.length > 0 ? (
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
