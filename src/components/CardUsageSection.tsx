import type { ReactNode } from "react";
import type { Reward } from "@/components/StampCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { getCardUsageRewards, getDefaultCardUsageInstructions, normalizeCardUsageInstructions } from "@/lib/card-usage";
import { cn } from "@/lib/utils";

const MAX_USAGE_LENGTH = 20000;

/** Approved AI instructions, with calculated milestones for cards without an AI draft. */
export function CardUsageSection({
  totalSteps,
  rewards,
  instructions,
  onInstructionsChange,
  open,
  onOpenChange,
  headerAction,
  className,
}: {
  totalSteps: number;
  rewards: readonly Reward[] | null | undefined;
  instructions?: string | null;
  /** Supply to let an owner write or refine the copy; omit for the read-only customer view. */
  onInstructionsChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headerAction?: ReactNode;
  className?: string;
}) {
  const milestones = getCardUsageRewards(totalSteps, rewards);
  const usageText = normalizeCardUsageInstructions(totalSteps, rewards, instructions);
  const editable = !!onInstructionsChange;
  return (
    <Accordion type="single" collapsible
      {...(open === undefined ? {} : { value: open ? "usage" : "" })}
      onValueChange={onOpenChange ? (value) => onOpenChange(value === "usage") : undefined}
      className={cn("rounded-2xl border border-border bg-card", className)}>
      <AccordionItem value="usage" className="border-0">
        <div className={cn(headerAction && "relative flex items-center gap-2 pl-3 pr-9 sm:pl-4 [&>h3]:min-w-0")}>
          <AccordionTrigger className={cn(
            "gap-3 px-4 py-4 text-sm font-semibold hover:no-underline",
            headerAction && "min-w-0 gap-0 px-0 [&>svg]:absolute [&>svg]:right-3",
          )}>
            How to use this card
          </AccordionTrigger>
          {headerAction}
        </div>
        <AccordionContent className="px-4">
          {editable ? (
            <>
              <Textarea
                id="card-usage-instructions"
                aria-label="How to use this card"
                data-i18n-ignore
                value={usageText}
                onChange={(event) => onInstructionsChange(event.target.value)}
                placeholder={getDefaultCardUsageInstructions(totalSteps, rewards)}
                rows={8}
                maxLength={MAX_USAGE_LENGTH}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {usageText.length}/{MAX_USAGE_LENGTH.toLocaleString("en-US")}
              </p>
            </>
          ) : usageText ? (
            <p data-i18n-ignore className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {usageText}
            </p>
          ) : milestones.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {milestones.map(({ step, label, afterStep }) => (
                <li key={step} className="break-words">
                  <span>{`After step ${afterStep} you will get voucher for`}</span>{" "}
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
