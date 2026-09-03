import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";

const BUSINESS_CTA_KEY = "cc_business_cta_hidden_until";
const BUSINESS_CTA_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared "Own a business?" prompt state. Dismissal is snoozed for a week and
 * shared across every placement, so hiding it in the desktop drawer also hides
 * the mobile wallet card.
 */
function useBusinessCta() {
  // Start hidden so the prompt never flashes before localStorage is read.
  const [hidden, setHidden] = useState(true);
  const { profile, loading } = useProfile();

  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(BUSINESS_CTA_KEY) ?? 0);
      setHidden(Number.isFinite(until) && until > Date.now());
    } catch {
      setHidden(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      window.localStorage.setItem(BUSINESS_CTA_KEY, String(Date.now() + BUSINESS_CTA_SNOOZE_MS));
    } catch {
      /* ignore */
    }
  }, []);

  return { visible: !loading && !profile?.hasBusiness && !hidden, dismiss };
}

type Props = {
  /** "card" is the roomy wallet panel; "drawer" is the compact desktop menu entry. */
  variant?: "card" | "drawer";
};

export function BusinessCta({ variant = "card" }: Props) {
  const { visible, dismiss } = useBusinessCta();
  if (!visible) return null;

  if (variant === "drawer") {
    return (
      <div className="relative rounded-xl border border-border bg-muted/40 p-3 text-left">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this suggestion for a week"
          className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-sm font-semibold leading-tight">Own a business?</h2>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Start your business profile and create your own customized loyalty card.
            </p>
          </div>
        </div>
        <Link to="/business" className="mt-2.5 block">
          <Button size="sm" className="w-full gap-2">
            <Sparkles className="h-4 w-4" /> Start my business profile
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative px-5 pt-2 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto max-w-md rounded-2xl glass-panel border border-border p-4 text-left"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this suggestion for a week"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h2 className="font-display text-lg font-bold">Own a business?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground leading-snug">
              Start your business profile and create your own customized loyalty card.
            </p>
            <Link to="/business" className="mt-3 block">
              <Button size="sm" className="gap-2">
                <Sparkles className="h-4 w-4" /> Start my business profile
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
