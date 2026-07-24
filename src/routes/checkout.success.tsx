import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Welcome to Pro — Stempel" },
      { name: "description", content: "Your Stempel Business subscription is active." },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const readReturn = () => {
      try {
        const p = sessionStorage.getItem("post_checkout_return");
        sessionStorage.removeItem("post_checkout_return");
        return p && p.startsWith("/") ? p : "/business";
      } catch {
        return "/business";
      }
    };

    const target = readReturn();

    // Poll briefly for the session to be present, then navigate.
    const tick = async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getUser();
      attempts += 1;
      if (data.user) {
        toast.success("Welcome to Pro! Your subscription is active.");
        navigate({ to: target, replace: true });
        return;
      }
      if (attempts > 10) {
        // Fall back to auth with intended path
        navigate({ to: "/auth", search: { redirect: target }, replace: true });
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8 text-center max-w-sm"
      >
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">You're on Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Finalizing your subscription and taking you back…
        </p>
      </motion.div>
    </div>
  );
}
