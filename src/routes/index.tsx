import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Logo } from "@/components/Logo";
import { WalletShowcase } from "@/components/WalletShowcase";
import type { StampCardProps } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Sparkles,
  QrCode,
  Palette,
  Users,
  Gift,
  TrendingUp,
  Bell,
  Wallet,
  Smartphone,
  ShieldCheck,
  Store,
  ArrowRight,
} from "lucide-react";
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
      { title: "Clubcarder — Digital loyalty cards that live in every pocket" },
      { name: "description", content: "Clubcarder replaces paper punch cards with beautiful digital stamp cards. Great for cafés, salons, and shops — loved by their regulars." },
      { property: "og:title", content: "Clubcarder — Digital loyalty cards" },
      { property: "og:description", content: "Replace paper punch cards with digital ones. Businesses design them, customers collect them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const heroCards: StampCardProps[] = [
  {
    title: "CAFÉ NORD", cornerTitle: "Café Nord", subtitle: "Every 8th cup of coffee is free",
    totalSteps: 8, stampsCount: 5, stampIcon: "coffee",
    bgColor: "#f5efe4", accentColor: "#4a2c1a", textColor: "#4a2c1a",
    rewards: [{ step: 8, label: "FREE" }],
    businessName: "CAFÉ NORD", face: "info",
  },
  {
    title: "THE COOKIE JAR", cornerTitle: "The Cookie Jar", subtitle: "Every 6th cookie is free",
    totalSteps: 6, stampsCount: 3, stampIcon: "cookie",
    bgColor: "#fff4e6", accentColor: "#8a4b12", textColor: "#5c3a1e",
    rewards: [{ step: 6, label: "FREE" }], businessName: "THE COOKIE JAR",
    shape: "rounded", face: "info",
  },
  {
    title: "FORGE GYM", cornerTitle: "Forge Gym", subtitle: "Free session every 10 visits",
    totalSteps: 10, stampsCount: 6, stampIcon: "flame",
    bgColor: "#1a1a1f", accentColor: "#f5b73a", textColor: "#f5f2e8",
    rewards: [{ step: 10, label: "FREE" }], businessName: "FORGE GYM", face: "info",
  },
  {
    title: "VINBAR 22", cornerTitle: "Vinbar 22", subtitle: "Every 6th glass of wine is on us",
    totalSteps: 6, stampsCount: 2, stampIcon: "wine",
    bgColor: "#2a1a24", accentColor: "#e8b4c0", textColor: "#f5e6ea",
    rewards: [{ step: 6, label: "FREE" }], businessName: "VINBAR 22", face: "info",
  },
];

const businessBenefits = [
  { icon: QrCode, title: "QR-based stamping", body: "Customers scan your business QR to claim a card. You scan theirs to stamp it. No hardware needed." },
  { icon: Palette, title: "Your brand, your card", body: "Choose colors, shapes, stamp icons, rewards, and wording — every card feels like your shop." },
  { icon: Users, title: "Know your regulars", body: "See who has your cards, how close they are to a reward, and which offers bring them back." },
  { icon: Gift, title: "Flexible rewards", body: "Set discounts, freebies, or milestones at any step. Run any punch-card rule you can imagine." },
  { icon: TrendingUp, title: "Grow repeat visits", body: "Digital cards live on the customer’s phone, so they’re never lost and always top of mind." },
  { icon: Bell, title: "Easy to share", body: "Display your QR at the counter, on receipts, or online. One scan puts your card in their wallet." },
];

const customerBenefits = [
  { icon: Wallet, title: "All cards in one place", body: "No more paper cards crammed in your wallet. Every stamp card lives neatly on your phone." },
  { icon: QrCode, title: "Scan to collect", body: "Point your camera at a shop’s QR code to grab their card. It takes seconds and works on any phone." },
  { icon: Gift, title: "Rewards you can see", body: "Watch your stamps add up and see exactly how close you are to your next freebie." },
  { icon: Bell, title: "Never miss a reward", body: "Your progress is always up to date. No faded stamps, no ‘lost card, no free coffee’ moments." },
  { icon: Smartphone, title: "No app to install", body: "Open the site, scan, and go. Your cards are saved to your account and accessible anywhere." },
  { icon: ShieldCheck, title: "You’re in control", body: "Each card is yours. You decide which to keep, and businesses can only stamp with your permission." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Iridescent floating blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[oklch(0.82_0.16_300/0.45)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/4 -right-16 h-80 w-80 rounded-full bg-[oklch(0.86_0.14_195/0.45)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[oklch(0.88_0.14_340/0.35)] blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-9 w-9 rotate-[-8deg] drop-shadow-md" />
          <span className="font-display text-xl font-extrabold tracking-tight">Clubcarder</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="rounded-full">Sign in</Button>
          </Link>
          <Link to="/auth" className="hidden sm:block">
            <Button size="sm" className="rounded-full">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-16">
        {/* HERO — intro */}
        <section className="grid items-center gap-12 py-10 lg:grid-cols-2 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Meet Clubcarder
            </span>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
              Loyalty cards that live in every pocket.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Clubcarder replaces paper punch cards with beautiful digital stamp cards.
              Businesses design them in minutes, customers collect them with a scan —
              and nobody ever loses a free coffee again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">Get started</Button>
              </Link>
              <a href="#for-customers">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  See how it works <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto"
          >
            <WalletShowcase cards={heroCards} />
          </motion.div>
        </section>

        {/* FOR CUSTOMERS */}
        <section id="for-customers" className="mt-20 scroll-mt-24">
          <div className="mb-10 text-center">
            <OrnamentDivider className="mx-auto mb-5 w-32" />
            <span className="inline-flex items-center gap-1.5 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Wallet className="h-3 w-3" /> For customers
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Never lose a punch card again
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Collect stamps, track rewards, and keep every loyalty card in one place — right on your phone.
            </p>
          </div>
          <BenefitGrid items={customerBenefits} />
          <div className="mt-8 text-center">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8">Open my wallet</Button>
            </Link>
          </div>
        </section>

        {/* FOR BUSINESSES */}
        <section id="for-business" className="mt-24 scroll-mt-24">
          <div className="mb-10 text-center">
            <OrnamentDivider className="mx-auto mb-5 w-32" />
            <span className="inline-flex items-center gap-1.5 rounded-full glass-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Store className="h-3 w-3" /> For businesses
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to run a loyalty program
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Design a card once, hand it out with a QR, and turn first-time visitors into regulars.
            </p>
          </div>
          <BenefitGrid items={businessBenefits} />
          <div className="mt-8 text-center">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8">Create your first card</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative mx-auto max-w-6xl px-6 py-10 text-center text-xs text-muted-foreground">
        <div className="mb-3 flex items-center justify-center gap-5">
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </div>
        © Clubcarder
      </footer>
    </div>
  );
}

function BenefitGrid({ items }: { items: { icon: LucideIcon; title: string; body: string }[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((benefit, i) => {
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
  );
}
