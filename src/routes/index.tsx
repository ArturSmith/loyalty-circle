import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { StampCard } from "@/components/StampCard";
import { Scissors, QrCode, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Stempel — Digital loyalty cards for local businesses" },
    { name: "description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, and shops." },
  ]}),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5" />
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
            <StampCard
              title="Milano Frisør"
              subtitle="5 klipp -50% · 10 gratis"
              totalSteps={10}
              stampsCount={4}
              businessName="MILANO FRISØR"
              rewards={[{ step: 5, label: "-50%" }, { step: 10, label: "FREE" }]}
              stampIcon="scissors"
            />
          </div>
          <motion.div initial={{ opacity: 0, y: 20, rotate: 6 }} animate={{ opacity: 1, y: 0, rotate: 6 }} transition={{ delay: 0.3 }} className="absolute -bottom-8 -right-4 max-w-[220px] hidden sm:block">
            <StampCard
              title="Café Nord"
              totalSteps={8}
              stampsCount={6}
              stampIcon="coffee"
              accentColor="#5a3a1a"
              rewards={[{ step: 8, label: "FREE" }]}
              businessName="CAFÉ NORD"
            />
          </motion.div>
        </motion.div>
      </section>

      <section className="border-t border-border/70 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-10">
          <Feature icon={QrCode} title="Scan to stamp" body="Customers open their card, business scans it. That's it. No app to install." />
          <Feature icon={Sparkles} title="Make it yours" body="Choose shape, colors, icons, and rewards. Every card looks distinctly you." />
          <Feature icon={Scissors} title="Know your regulars" body="See who's coming back, how close they are to a reward, and how you're growing." />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 flex items-center justify-between text-xs text-muted-foreground">
        <span>© Stempel</span>
        <OrnamentDivider className="w-24 opacity-50" />
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Scissors; title: string; body: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-full bg-ink text-paper flex items-center justify-center mb-4"><Icon className="h-4 w-4" /></div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
