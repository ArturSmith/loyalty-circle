import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Maximize2, QrCode, X } from "lucide-react";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { customerQrValue, shortCustomerCode } from "@/lib/customer-code";
import { setUserQrBrightness } from "@/lib/native";
import { cn } from "@/lib/utils";

type CustomerQrCardProps = {
  qrToken?: string | null;
  userId: string;
  displayName?: string | null;
  className?: string;
};

export function CustomerQrCard({ qrToken, userId, displayName, className }: CustomerQrCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const shortCode = shortCustomerCode(userId);
  const value = customerQrValue(qrToken || userId);

  useEffect(() => {
    setUserQrBrightness(expanded);
    return () => setUserQrBrightness(false);
  }, [expanded]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(shortCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The readable code remains visible and selectable when clipboard access
      // is unavailable in an embedded browser.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          "relative isolate flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-primary/45 bg-card p-3 text-left shadow-lg ring-1 ring-primary/15 transition-all hover:border-primary/65 hover:shadow-xl",
          className,
        )}
        aria-label="Open my customer QR"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 top-1/2 -z-10 h-60 w-60 -translate-y-1/2 rounded-full bg-primary/35 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-white/75 via-primary/10 to-transparent dark:from-white/20 dark:via-primary/15"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
        />

        <span className="relative z-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-[0_10px_30px_-10px_var(--primary)] ring-2 ring-white/90">
          <QrDisplay value={value} size={80} />
        </span>
        <span className="relative z-10 min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <QrCode className="h-4 w-4" aria-hidden="true" /> My QR
          </span>
          <span className="mt-1 block font-display text-lg font-bold">
            {displayName?.trim() || "Customer code"}
          </span>
          <span className="mt-1 block text-xs leading-snug text-muted-foreground">
            Show this when a business adds a stamp.
          </span>
          <span className="mt-2 block font-mono text-xs font-semibold tracking-wider">
            {shortCode}
          </span>
        </span>
        <span className="relative z-10 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm ring-1 ring-primary/15 dark:bg-white/15">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:items-center sm:p-5"
            onClick={() => setExpanded(false)}
          >
            <motion.section
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              transition={{ type: "spring", damping: 24, stiffness: 240 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-qr-title"
              className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-paper p-4 text-center shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Close customer QR"
              >
                <X className="h-5 w-5" />
              </button>

              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                ClubCarder customer
              </p>
              <h2 id="customer-qr-title" className="mt-1 font-display text-2xl font-bold">
                My QR
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                Let the business scan this code. They will only see cards connected to their
                business.
              </p>

              <div className="mx-auto mt-4 flex w-full max-w-[292px] justify-center rounded-3xl bg-white p-3 shadow-sm sm:mt-5 sm:p-4">
                <QrDisplay value={value} size={260} className="mx-auto" />
              </div>

              <div className="mt-4 rounded-2xl bg-secondary/60 px-3 py-2.5 sm:mt-5 sm:px-4 sm:py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Short code
                </p>
                <p className="mt-1 select-all font-mono text-xl font-bold tracking-widest">
                  {shortCode}
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-3 w-full gap-2 rounded-2xl"
                onClick={copyCode}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy short code"}
              </Button>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
