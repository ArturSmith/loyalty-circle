import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { WalletStack } from "@/components/WalletStack";
import type { StampCardProps } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import {
  QrCode,
  Palette,
  Users,
  Gift,
  TrendingUp,
  Bell,
  ArrowLeft,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/for-business")({
  head: () => ({
    meta: [
      { title: "For businesses — Stempel" },
      { name: "description", content: "Create digital stamp cards for your customers. Track visits, reward loyalty, and grow your business." },
      { property: "og:title", content: "For businesses — Stempel" },
      { property: "og:description", content: "Create digital stamp cards for your customers. Track visits, reward loyalty, and grow your business." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ForBusinessPage,
});

const benefits = [
  {
    icon: QrCode,
    title: "QR-based stamping",
    body: "Customers scan your business QR to claim a card. You scan their card QR to stamp it. No hardware needed.",
  },
  {
    icon: Palette,
    title: "Your brand, your card",
    body: "Choose colors, shapes, stamp icons, rewards, and wording. Every card feels like a natural extension of your shop.",
  },
  {
    icon: Users,
    title: "Know your regulars",
    body: "See who has your cards, how close they are to rewards, and which offers bring them back.",
  },
  {
    icon: Gift,
    title: "Flexible rewards",
    body: "Set discounts, freebies, or milestones at any step. Run a ‘5th visit half price, 10th free’ rule just like paper cards.",
  },
  {
    icon: TrendingUp,
    title: "Grow repeat visits",
    body: "Digital cards live in the customer’s phone, so they’re never lost and always top of mind.",
  },
  {
    icon: Bell,
    title: "Easy to share",
    body: "Display your business QR at the counter, in receipts, or online. One scan puts your loyalty card in their wallet.",
  },
];

function ForBusinessPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Stempel</span>
        </Link>
        <Link to="/auth">
          <Button size="sm">Get started</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/"
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <OrnamentDivider className="mb-6 w-32" />
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Loyalty cards that fit in every pocket.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Replace paper punch cards with a digital stamp card your customers
              carry on their phones. Design it once, stamp it in seconds, and
              turn first-time visitors into regulars.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">
                  Create your first card
                </Button>
              </Link>
              <Link to="/for-customers">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  I am a customer
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto"
          >
            <WalletStack cards={businessStackCards} />
          </motion.div>
        </div>


        <section className="mt-24">
          <div className="mb-12 text-center">
            <OrnamentDivider className="mx-auto mb-5 w-32" />
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to run a loyalty program
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                  className="rounded-2xl border border-border/70 bg-secondary/30 p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{benefit.body}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-muted-foreground">
        © Stempel
      </footer>
    </div>
  );
}
