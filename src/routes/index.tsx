import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Logo } from "@/components/Logo";
import { WalletShowcase } from "@/components/WalletShowcase";
import type { StampCardProps } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import walletPreviewAsset from "@/assets/loyalty-showcase.png.asset.json";
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
  UserPlus,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultHome } from "@/lib/defaultHome";
import { LanguageSwitcher } from "@/i18n";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // These redirect rather than render, so they replace the history entry —
    // otherwise "back" returns to `/`, which just redirects again, leaving the
    // browser and Android hardware back buttons stuck in a loop.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      const dest = await getDefaultHome(user.id);
      throw redirect({ to: dest, replace: true });
    }
    // Someone who installed the app doesn't need the marketing pitch — they're
    // already sold. Open on sign-in instead, the way a native app should.
    const { isNativeApp } = await import("@/lib/native");
    if (isNativeApp()) throw redirect({ to: "/auth", replace: true });
  },
  head: () => ({
    meta: [
      { title: "ClubCarder — Digital loyalty cards that live in every pocket" },
      { name: "description", content: "ClubCarder replaces paper punch cards with beautiful digital stamp cards. Great for cafés, salons, and shops — loved by their regulars." },
      { property: "og:title", content: "ClubCarder — Digital loyalty cards" },
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

const programLaunchSteps = [
  {
    step: 1,
    icon: UserPlus,
    title: "Sign up",
    body: "Create your personal ClubCarder account and verify your contact details.",
  },
  {
    step: 2,
    icon: Store,
    title: "Create your company",
    body: "Add your company name, category, brand details and customer-facing information.",
  },
  {
    step: 3,
    icon: Palette,
    title: "Build your loyalty card",
    body: "Choose the design, number of stamp steps and the rewards customers can earn.",
  },
  {
    step: 4,
    icon: ShieldCheck,
    title: "Submit for approval",
    body: "Send your company and first card for moderation. You can update the details while they are being reviewed.",
  },
  {
    step: 5,
    icon: QrCode,
    title: "Publish and share",
    body: "Once approved, share your public page or business QR and start welcoming members.",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Iridescent floating blobs */}

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-9 w-9 rotate-[-8deg] drop-shadow-md" />
          <span className="font-display text-xl font-extrabold tracking-tight">ClubCarder</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
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
              <Sparkles className="h-3 w-3" /> Meet ClubCarder
            </span>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
              Loyalty cards that live in every pocket.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              ClubCarder replaces paper punch cards with beautiful digital stamp cards.
              Businesses design them in minutes, customers collect them with a scan —
              and nobody ever loses a free coffee again.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">Get started</Button>
              </Link>
              <a href="#start-a-program">
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

        {/* PRODUCT SHOWCASE */}
        <section className="mt-20 scroll-mt-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6 }}
            >
              <img
                src={walletPreviewAsset.url}
                alt="Paper punch card next to a digital ClubCarder card on a phone"
                className="w-full rounded-3xl"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Your loyalty cards, always in your pocket.
              </h2>
              <p className="mt-4 max-w-lg text-lg text-muted-foreground">
                Customers scan your business QR once and their digital stamp card lives right in their ClubCarder wallet. No paper to lose — just tap, stamp, and reward.
              </p>
              <ul className="mt-6 space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>One QR scan puts the card in your ClubCarder wallet.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>Stamps update instantly when the business scans your code.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>Rewards are visible anytime, anywhere — no login required at the counter.</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </section>

        <ProgramLaunchSteps />

        {/* SWIPEABLE BENEFITS */}
        <SwipeableBenefits customerBenefits={customerBenefits} businessBenefits={businessBenefits} />
      </main>

      <footer className="relative mx-auto max-w-6xl px-6 py-10 text-center text-xs text-muted-foreground">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/refunds" className="hover:text-foreground">Refunds</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </div>
        © Muzaev AS · ClubCarder
      </footer>

    </div>
  );
}

function ProgramLaunchSteps() {
  return (
    <section id="start-a-program" className="mt-20 scroll-mt-24 rounded-[2rem] border border-border/70 bg-secondary/30 px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">For businesses</span>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Launch your loyalty program in five steps
        </h2>
        <p className="mt-3 text-muted-foreground">
          Go from a new account to a published, shareable loyalty card without complicated setup.
        </p>
      </div>

      <div className="relative mx-auto mt-9 max-w-5xl">
        <div aria-hidden="true" className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-border lg:block" />
        <ol className="relative grid gap-3 lg:grid-cols-5 lg:gap-4">
          {programLaunchSteps.map(({ step, icon: Icon, title, body }, index) => (
            <motion.li
              key={step}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="relative flex gap-4 rounded-2xl border border-border/60 bg-card/85 p-4 lg:block lg:border-0 lg:bg-transparent lg:px-2 lg:py-0 lg:text-center"
            >
              <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-card text-primary shadow-sm lg:mx-auto">
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {step}
                </span>
              </div>
              <div className="min-w-0 lg:mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Step {step}</p>
                <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>

      <div className="mt-9 text-center">
        <Link to="/auth">
          <Button size="lg" className="h-12 px-8">
            Start your loyalty program <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Your free trial starts when your company is approved.</p>
      </div>
    </section>
  );
}

function SwipeableBenefits({
  customerBenefits,
  businessBenefits,
}: {
  customerBenefits: { icon: LucideIcon; title: string; body: string }[];
  businessBenefits: { icon: LucideIcon; title: string; body: string }[];
}) {
  const [active, setActive] = useState<"customers" | "business">("customers");

  const tabs = [
    { id: "customers" as const, label: "For customers", icon: Wallet },
    { id: "business" as const, label: "For businesses", icon: Store },
  ];

  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number } },
  ) => {
    const threshold = 60;
    const velocityThreshold = 300;
    // Ignore gestures that are mostly vertical (page scrolling)
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      setActive("business");
    } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      setActive("customers");
    }
  };


  return (
    <section id="benefits" className="mt-20 scroll-mt-24">
      <div className="mb-8 text-center">
        <OrnamentDivider className="mx-auto mb-5 w-32" />
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          See how it works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Swipe to see what ClubCarder does for customers and businesses.
        </p>
      </div>

      {/* Tabs */}
      <div className="mx-auto mb-6 flex w-fit items-center gap-1 rounded-full border border-border/60 bg-secondary/40 p-1 backdrop-blur-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeBenefitTab"
                  className="absolute inset-0 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Swipeable panels */}
      <div className="relative overflow-hidden">
        <motion.div
          className="flex w-[200%] cursor-grab active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          animate={{ x: active === "customers" ? "0%" : "-50%" }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
          onDragEnd={handleDragEnd}
        >
          <div className="w-1/2 shrink-0 px-2">
            <BenefitGrid items={customerBenefits} />
            <div className="mt-8 text-center">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">Open my wallet</Button>
              </Link>
            </div>
          </div>
          <div className="w-1/2 shrink-0 px-2">
            <BenefitGrid items={businessBenefits} />
            <div className="mt-8 text-center">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">Create your first card</Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Swipe hints */}
        <div className="pointer-events-none absolute inset-y-0 left-2 hidden items-center sm:flex">
          <div className={`rounded-full bg-background/80 p-2 shadow-lg backdrop-blur transition-opacity ${active === "customers" ? "opacity-0" : "opacity-60"}`}>
            <ArrowRight className="h-4 w-4 -scale-x-100" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-2 hidden items-center sm:flex">
          <div className={`rounded-full bg-background/80 p-2 shadow-lg backdrop-blur transition-opacity ${active === "business" ? "opacity-0" : "opacity-60"}`}>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </section>
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
