import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/QrScanner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Sparkles, XCircle } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/_authenticated/business/scan")({
  head: () => ({ meta: [{ title: "Scan customer — ClubCarder" }] }),
  component: ScanPage,
});

type Result = { stamps_count: number; total_steps: number; reward: { step: number; label: string } | null; completed: boolean };
type Rejection = { title: string; message: string };

function describeError(raw: string): Rejection {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("not authorized")) {
    return {
      title: "Not your card",
      message: "This loyalty card belongs to a different business, so you can't stamp it.",
    };
  }
  if (msg.includes("card not found")) {
    return { title: "Card not found", message: "This QR doesn't match any active card. Ask the customer to reopen it." };
  }
  if (msg.includes("card is full")) {
    return { title: "Card is full", message: "Every step is stamped. Give the reward, then the customer can renew the card." };
  }
  if (msg.includes("please wait")) {
    return { title: "Just stamped", message: "This card was stamped a moment ago. Wait a few seconds before stamping again." };
  }
  if (msg.includes("subscription required")) {
    return { title: "Stamping paused", message: "This business isn't covered by an active subscription. Renew to resume stamping." };
  }
  if (msg.includes("auth required")) {
    return { title: "Signed out", message: "Your session expired. Sign in again to keep stamping." };
  }
  return { title: "Couldn't stamp", message: raw || "Something went wrong. Try scanning again." };
}

function ScanPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [paused, setPaused] = useState(false);

  const onScan = useCallback(async (text: string) => {
    if (busy || paused) return;
    const m = text.match(/^stempel:card:([0-9a-f-]+)$/i);
    if (!m) { toast.error("Not a ClubCarder card QR"); return; }
    setBusy(true); setPaused(true);
    try {
      const { data, error } = await supabase.rpc("add_stamp", {
        _card_instance_id: m[1],
        _env: getPaddleEnvironment(),
      });
      if (error) { setRejection(describeError(error.message)); return; }
      setResult(data as unknown as Result);
    } catch (e) {
      setRejection(describeError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }, [busy, paused]);

  const reset = () => { setResult(null); setRejection(null); setPaused(false); };


  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Scan to stamp</p>
          <h1 className="font-display text-2xl font-semibold">Point at customer's QR</h1>
        </div>
      </header>

      <div className="mt-6">
        <QrScanner onScan={onScan} paused={paused} />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Ask the customer to open their card and tap it to reveal the QR.
      </p>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center">
              <OrnamentDivider className="w-40 mx-auto opacity-70" />
              {result.completed ? (
                <>
                  <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                    className="mt-4 mx-auto h-20 w-20 rounded-full bg-gold text-ink flex items-center justify-center">
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Complete!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Card fully stamped — give the reward.</p>
                </>
              ) : (
                <>
                  <motion.div initial={{ scale: 3, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="mt-4 mx-auto h-20 w-20 rounded-full bg-ink text-paper flex items-center justify-center stamp-emboss">
                    <Check className="h-8 w-8" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Stamped</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{result.stamps_count} of {result.total_steps} stamps</p>
                  {result.reward && (
                    <div className="mt-3 rounded-lg bg-gold/20 text-ink px-4 py-2 text-sm font-semibold">
                      Reward unlocked: {result.reward.label}
                    </div>
                  )}
                </>
              )}
              <OrnamentDivider className="w-40 mx-auto opacity-70 mt-6" />
              <Button className="mt-6 w-full h-11" onClick={reset}>Scan next</Button>
            </motion.div>
          </motion.div>
        )}

        {rejection && !result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center">
              <motion.div initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="mx-auto h-20 w-20 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
                <XCircle className="h-9 w-9" />
              </motion.div>
              <h2 className="font-display text-3xl mt-4">{rejection.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{rejection.message}</p>
              <Button className="mt-6 w-full h-11" onClick={reset}>Scan another card</Button>
              <Button variant="ghost" className="mt-2 w-full h-10" onClick={() => navigate({ to: "/business" })}>
                Back to dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
