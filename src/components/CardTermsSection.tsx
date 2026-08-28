import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type CardTermsSectionProps = {
  terms: string;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  termsClassName?: string;
};

export function CardTermsSection({
  terms,
  meta,
  children,
  className,
  titleClassName,
  termsClassName,
}: CardTermsSectionProps) {
  return (
    <Accordion
      type="single"
      collapsible
      className={cn("rounded-2xl border border-border bg-card", className)}
    >
      <AccordionItem value="terms" className="border-0">
        <AccordionTrigger className="gap-3 px-4 py-4 hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span className={cn("text-sm font-semibold", titleClassName)}>Terms &amp; conditions</span>
            {meta}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <p
            className={cn(
              "whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground",
              termsClassName,
            )}
          >
            {terms}
          </p>
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

