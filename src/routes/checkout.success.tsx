import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Welcome to Pro — ClubCarder" },
      { name: "description", content: "Your ClubCarder Business subscription is active." },
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
    const env = getPaddleEnvironment();

    // Wait for the session AND for the payment webhook to land, so the user
    // isn't bounced back into the paywall right after paying.
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        if (attempts > 20) {
          navigate({ to: "/auth", search: { redirect: target }, replace: true });
          return;
        }
        setTimeout(tick, 400);
        return;
      }

      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id,status,current_period_end")
        .eq("user_id", data.user.id)
        .eq("environment", env)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1);

      if ((subs?.length ?? 0) > 0) {
        toast.success("Welcome to Pro! Your subscription is active.");
        navigate({ to: target, replace: true });
        return;
      }

      if (attempts > 30) {
        // ~12s. Payment succeeded but confirmation is slow — send them on anyway.
        toast.success("Payment received. Your plan will activate in a moment.");
        navigate({ to: target, replace: true });
        return;
      }
      setTimeout(tick, 400);
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
