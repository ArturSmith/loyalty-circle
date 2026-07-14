import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Button } from "@/components/ui/button";
import { Stamp, Store, Wallet, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stempel — Digital loyalty cards for local businesses" },
      { name: "description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Stamp className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Stempel</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <OrnamentDivider className="mx-auto mb-6 w-32" />
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Who are you today?
            </h1>
            <p className="mt-3 text-muted-foreground">
              Pick the path that fits you.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <ChoiceCard
              to="/for-business"
              title="I run a business"
              description="Create digital stamp cards, share them with customers, and track loyalty — no paper, no hassle."
              icon={Store}
            />
            <ChoiceCard
              to="/for-customers"
              title="I am a customer"
              description="Collect stamps, track rewards, and keep every loyalty card in one place on your phone."
              icon={Wallet}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ChoiceCard({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: "/for-business" | "/for-customers";
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group relative flex h-full flex-col rounded-2xl border border-border/70 bg-background p-8 shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary/30"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 flex-1 text-muted-foreground">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
          Learn more
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </motion.div>
    </Link>
  );
}
