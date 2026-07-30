import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/QrScanner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine } from "lucide-react";
import { AppBar } from "@/components/AppBar";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan QR — Clubcarder" }] }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);

  const onScan = useCallback((text: string) => {
    if (paused) return;
    setPaused(true);

    // Accept either a full business URL or a stempel:business:<id> scheme
    const urlMatch = text.match(/\/b\/([0-9a-f-]+)/i);
    const schemeMatch = text.match(/^stempel:business:([0-9a-f-]+)$/i);
    const businessId = urlMatch?.[1] ?? schemeMatch?.[1];

    if (!businessId) {
      toast.error("Not a Clubcarder business QR");
      setTimeout(() => setPaused(false), 1500);
      return;
    }

    navigate({ to: "/b/$businessId", params: { businessId } });
  }, [paused, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppBar
        variant="simple"
        title="Scan QR"
        subtitle="Point at a business QR code"
        backHref="/wallet"
      />

      <div className="flex-1 flex flex-col px-5 pb-8">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <QrScanner onScan={onScan} paused={paused} />
          </div>
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-secondary mb-3">
            <ScanLine className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Scan a Clubcarder business QR to claim a loyalty card.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-xs rounded-2xl bg-card paper-grain card-shadow p-6 text-center"
            >
              <p className="text-sm text-muted-foreground">Opening business page…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
