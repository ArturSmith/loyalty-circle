import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, QrCode, RefreshCw, X } from "lucide-react";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { stampQrValue } from "@/lib/stamp-qr";

type IssuedToken = { token: string; expires_at: string };
type Redemption = { customerName: string | null };

/** How often we ask whether the displayed code has been scanned. */
const POLL_INTERVAL_MS = 2_000;
/** How long the "Stamped" confirmation stays up before the dialog closes. */
const CONFIRMATION_MS = 2_500;

/**
 * Shows a single-use QR the customer scans to stamp this card themselves.
 *
 * The code is spent the moment it is redeemed, so the dialog confirms the stamp
 * and then closes rather than leaving a dead code on screen. Expiry is a second
 * line of defence for the case nobody scans at all and the code is photographed
 * instead.
 */
export function CardStampQrDialog({
  templateId,
  cardTitle,
  open,
  onOpenChange,
  onStamped,
}: {
  templateId: string;
  cardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStamped?: () => void;
}) {
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // Guards against a poll that resolves after the dialog closed or after the
  // code was already replaced, which would resurrect a spent token.
  const requestId = useRef(0);

  const issueToken = useCallback(async () => {
    const id = ++requestId.current;
    setIssuing(true);
    setError(null);
    setRedemption(null);
    const { data, error: rpcError } = await supabase.rpc("issue_card_stamp_qr_token", {
      _template_id: templateId,
      _env: getPaddleEnvironment(),
    });
    if (id !== requestId.current) return;
    setIssuing(false);
    if (rpcError) {
      setIssued(null);
      setError(
        rpcError.message.includes("permission required")
          ? "You don't have permission to stamp cards for this business."
          : rpcError.message.includes("subscription required")
            ? "Stamping is paused until this business has an active subscription."
            : "Couldn't create a code. Check your connection and try again.",
      );
      return;
    }
    setIssued(data as unknown as IssuedToken);
  }, [templateId]);

  useEffect(() => {
    if (!open) {
      requestId.current += 1;
      setIssued(null);
      setRedemption(null);
      setError(null);
      setSecondsLeft(0);
      return;
    }
    void issueToken();
  }, [open, issueToken]);

  // Watch the live code until it is scanned or runs out.
  useEffect(() => {
    if (!open || !issued || redemption) return;
    const id = requestId.current;
    let cancelled = false;

    const poll = async () => {
      const { data, error: rpcError } = await supabase.rpc("peek_card_stamp_qr_token", {
        _token: issued.token,
      });
      if (cancelled || rpcError || id !== requestId.current) return;
      const status = data as unknown as { status: string; customer_name?: string | null };
      if (status.status === "redeemed") {
        setRedemption({ customerName: status.customer_name ?? null });
        onStamped?.();
      } else if (status.status === "expired") {
        void issueToken();
      }
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, issued, redemption, issueToken, onStamped]);

  // Let the confirmation register, then get out of the way.
  useEffect(() => {
    if (!redemption) return;
    const timer = window.setTimeout(() => onOpenChange(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [redemption, onOpenChange]);

  useEffect(() => {
    if (!issued || redemption) {
      setSecondsLeft(0);
      return;
    }
    const tick = () =>
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(issued.expires_at).getTime() - Date.now()) / 1000)),
      );
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [issued, redemption]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = `${secondsLeft % 60}`.padStart(2, "0");

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink/80 px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-[max(0.75rem,var(--safe-top))] backdrop-blur-md sm:items-center sm:px-5"
          onClick={() => onOpenChange(false)}
        >
          <motion.section
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: "spring", damping: 24, stiffness: 240 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stamp-qr-title"
            className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-paper p-4 text-center shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Close stamping QR"
            >
              <X className="h-5 w-5" />
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
              One-time stamp
            </p>
            <h2 id="stamp-qr-title" className="mt-1 font-display text-2xl font-bold">
              {cardTitle}
            </h2>

            {error ? (
              <>
                <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">{error}</p>
                <Button className="mt-5 w-full rounded-2xl" onClick={() => void issueToken()}>
                  Try again
                </Button>
              </>
            ) : redemption ? (
              <div className="py-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, stiffness: 220 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                >
                  <CheckCircle2 className="h-9 w-9" />
                </motion.div>
                <p className="mt-4 font-display text-2xl">Stamped</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {redemption.customerName ?? "Customer"} collected a stamp.
                </p>
              </div>
            ) : (
              <>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                  Let the customer scan this with ClubCarder. It works once, then refreshes
                  automatically.
                </p>

                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-foreground">
                  <RefreshCw
                    className={`h-3 w-3 ${issuing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {issuing || !issued ? "Creating code…" : `Expires in ${minutes}:${seconds}`}
                </p>

                <div className="mx-auto mt-4 flex aspect-square w-full max-w-[292px] items-center justify-center rounded-3xl bg-white p-3 shadow-sm sm:mt-5 sm:p-4">
                  {issued ? (
                    <QrDisplay value={stampQrValue(issued.token)} size={260} className="mx-auto" />
                  ) : (
                    <QrCode className="h-16 w-16 animate-pulse text-muted-foreground" />
                  )}
                </div>

                <Button
                  variant="outline"
                  className="mt-4 w-full gap-2 rounded-2xl"
                  disabled={issuing}
                  onClick={() => void issueToken()}
                >
                  <RefreshCw className="h-4 w-4" /> New code
                </Button>
              </>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
