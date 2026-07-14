import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { StampCard, type StampCardProps } from "@/components/StampCard";
import { Stamp, QrCode, Sparkles, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Stempel — Digital loyalty cards for local businesses" },
    { name: "description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
  ]}),
  component: Landing,
});

const showcaseCards: StampCardProps[] = [
  {
    title: "Café Nord",
    subtitle: "10th coffee on the house",
    totalSteps: 10, stampsCount: 7,
    stampIcon: "coffee",
    bgColor: "#f5efe4", accentColor: "#4a2c1a", textColor: "#4a2c1a",
    rewards: [{ step: 10, label: "FREE" }],
    businessName: "CAFÉ NORD",
  },
  {
    title: "Bloom & Wild",
    subtitle: "5th bouquet -30%",
    totalSteps: 8, stampsCount: 4,
    stampIcon: "heart",
    bgColor: "#faf0f2", accentColor: "#8a2447", textColor: "#8a2447",
    rewards: [{ step: 5, label: "-30%" }, { step: 8, label: "FREE" }],
    businessName: "BLOOM & WILD",
    shape: "rounded",
  },
  {
    title: "Baker's Row",
    subtitle: "Free loaf at 10",
    totalSteps: 10, stampsCount: 9,
    stampIcon: "cookie",
    bgColor: "#fbf3e4", accentColor: "#6b4a1f", textColor: "#6b4a1f",
    rewards: [{ step: 10, label: "FREE" }],
    businessName: "BAKER'S ROW",
  },
  {
    title: "Vinbar 22",
    subtitle: "5th glass -50%",
    totalSteps: 6, stampsCount: 3,
    stampIcon: "wine",
    bgColor: "#1e1a24", accentColor: "#d4a24c", textColor: "#f0e6d2",
    rewards: [{ step: 5, label: "-50%" }, { step: 6, label: "FREE" }],
    businessName: "VINBAR 22",
    shape: "ticket",
  },
  {
    title: "Forge Gym",
    subtitle: "10 sessions, 1 free",
    totalSteps: 10, stampsCount: 5,
    stampIcon: "flame",
    bgColor: "#0f1720", accentColor: "#f97316", textColor: "#e6edf3",
    rewards: [{ step: 10, label: "FREE" }],
    businessName: "FORGE GYM",
  },
  {
    title: "Milano Frisør",
    subtitle: "5 klipp -50% · 10 gratis",
    totalSteps: 10, stampsCount: 4,
    stampIcon: "sparkles",
    bgColor: "#faf8f2", accentColor: "#1a1a2e", textColor: "#1a1a2e",
    rewards: [{ step: 5, label: "-50%" }, { step: 10, label: "FREE" }],
    businessName: "MILANO FRISØR",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Stamp className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Stempel</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth"><Button size="sm">Get started</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <OrnamentDivider className="w-40 mb-6" />
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] font-semibold tracking-tight">
            Punch cards, <em className="text-gold not-italic">reinvented</em> for your pocket.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg">
            Create beautiful digital loyalty cards for your business. Customers collect stamps by scanning a QR — no wallet clutter, no lost cards.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg" className="h-12 px-6">I run a business</Button></Link>
            <Link to="/wallet"><Button size="lg" variant="outline" className="h-12 px-6">I have a card</Button></Link>
          </div>
          <OrnamentDivider className="w-40 mt-10 opacity-60" />
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: -3 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
          <div className="max-w-sm mx-auto">
            <StampCard {...showcaseCards[0]} />
          </div>
          <motion.div initial={{ opacity: 0, y: 20, rotate: 6 }} animate={{ opacity: 1, y: 0, rotate: 6 }} transition={{ delay: 0.3 }} className="absolute -bottom-8 -right-4 max-w-[220px] hidden sm:block">
            <StampCard {...showcaseCards[1]} />
          </motion.div>
        </motion.div>
      </section>

      <section className="border-t border-border/70 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col items-center text-center mb-12">
            <OrnamentDivider className="w-32 mb-5" />
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
              Every business, its own card.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Cafés, florists, bakeries, wine bars, gyms, salons — shape, color, icon and rewards, all yours to design.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              >
                <StampCard {...card} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-10">
          <Feature icon={QrCode} title="Scan to stamp" body="Customers open their card, business scans it. That's it. No app to install." />
          <Feature icon={Sparkles} title="Make it yours" body="Choose shape, colors, icons, and rewards. Every card looks distinctly you." />
          <Feature icon={BarChart3} title="Know your regulars" body="See who's coming back, how close they are to a reward, and how you're growing." />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 flex items-center justify-between text-xs text-muted-foreground">
        <span>© Stempel</span>
        <OrnamentDivider className="w-24 opacity-50" />
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-full bg-ink text-paper flex items-center justify-center mb-4"><Icon className="h-4 w-4" /></div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
