import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Stamp, Store, Wallet, ArrowRight, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      throw redirect({ to: "/wallet" });
    }
  },
  head: () => ({
    meta: [
      { title: "Clubcarder — Digital loyalty cards for local businesses" },
      { name: "description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Iridescent floating blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[oklch(0.82_0.16_300/0.45)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[oklch(0.86_0.14_195/0.45)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-1/4 h-56 w-56 rounded-full bg-[oklch(0.88_0.14_340/0.35)] blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] text-white sticker-shadow">
            <Stamp className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight">Clubcarder</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="rounded-full">
            Sign in
          </Button>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Welcome
            </span>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
              Who are<br />
              <span className="text-iridescent italic">you today?</span>
            </h1>
            <p className="mt-4 text-muted-foreground">Pick the path that fits you.</p>
          </motion.div>

          {/* Broken grid choice cards */}
          <div className="mt-12 flex flex-col gap-5 sm:mt-14">
            <ChoiceCard
              to="/for-business"
              tag="Merchant"
              title="I run a business"
              description="Create digital stamp cards, share them with customers, and track loyalty — no paper, no hassle."
              icon={Store}
              variant="lilac"
              offset="left"
            />
            <ChoiceCard
              to="/for-customers"
              tag="Collector"
              title="I am a customer"
              description="Collect stamps, track rewards, and keep every loyalty card in one place on your phone."
              icon={Wallet}
              variant="iris"
              offset="right"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

type ChoiceVariant = "lilac" | "iris";

function ChoiceCard({
  to,
  tag,
  title,
  description,
  icon: Icon,
  variant,
  offset,
}: {
  to: "/for-business" | "/for-customers";
  tag: string;
  title: string;
  description: string;
  icon: LucideIcon;
  variant: ChoiceVariant;
  offset: "left" | "right";
}) {
  const gradient = variant === "lilac" ? "var(--gradient-lilac)" : "var(--gradient-iris)";
  const tagTone = variant === "lilac" ? "text-[oklch(0.5_0.22_285)]" : "text-[oklch(0.55_0.2_340)]";
  const shift = offset === "left" ? "sm:-ml-4 -rotate-[1.5deg]" : "sm:ml-8 rotate-[1.5deg]";

  return (
    <Link to={to} className={`block ${shift}`}>
      <motion.div
        whileHover={{ y: -6, rotate: 0 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 sticker-shadow border border-white/70"
        style={{ backgroundImage: gradient }}
      >
        <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 backdrop-blur-md text-foreground sticker-shadow">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className={`block text-[10px] font-bold uppercase tracking-[0.2em] ${tagTone}`}>{tag}</span>
            <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-foreground">{title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{description}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              Learn more
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
