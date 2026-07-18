import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useEffect, useState } from "react";
import { StampCard, type StampCardProps } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import {
  Wallet,
  QrCode,
  Gift,
  Bell,
  Smartphone,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/for-customers")({
  head: () => ({
    meta: [
      { title: "For customers — Stempel" },
      { name: "description", content: "Keep every digital stamp card in one place. Collect stamps, track rewards, and never lose a punch card again." },
      { property: "og:title", content: "For customers — Stempel" },
      { property: "og:description", content: "Keep every digital stamp card in one place. Collect stamps, track rewards, and never lose a punch card again." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ForCustomersPage,
});

const benefits = [
  {
    icon: Wallet,
    title: "All cards in one place",
    body: "No more paper cards crammed in your wallet. Every stamp card you collect lives neatly in your digital wallet.",
  },
  {
    icon: QrCode,
    title: "Scan to collect",
    body: "Point your camera at the shop’s QR code to grab their card. It takes seconds and works on any phone.",
  },
  {
    icon: Gift,
    title: "Rewards you can see",
    body: "Watch your stamps add up and see exactly how close you are to your next freebie or discount.",
  },
  {
    icon: Bell,
    title: "Never miss a reward",
    body: "Your progress is always up to date. No faded stamps, no ‘lost card, no free coffee’ moments.",
  },
  {
    icon: Smartphone,
    title: "No app to install",
    body: "Open the site, scan, and go. Your cards are saved to your account and accessible anywhere.",
  },
  {
    icon: ShieldCheck,
    title: "You’re in control",
    body: "Each card is yours. You decide which cards to keep, and businesses can only stamp with your permission.",
  },
];

const customerStackCards: StampCardProps[] = [
  {
    title: "Baker's Row", subtitle: "Free loaf at 10", totalSteps: 10, stampsCount: 9,
    stampIcon: "cookie", bgColor: "#fbf3e4", accentColor: "#6b4a1f", textColor: "#6b4a1f",
    rewards: [{ step: 10, label: "FREE" }], businessName: "BAKER'S ROW",
  },
  {
    title: "Café Nord", subtitle: "10th coffee free", totalSteps: 10, stampsCount: 5,
    stampIcon: "coffee", bgColor: "#f5efe4", accentColor: "#4a2c1a", textColor: "#4a2c1a",
    rewards: [{ step: 10, label: "FREE" }], businessName: "CAFÉ NORD",
  },
  {
    title: "Milan Frisør", subtitle: "5th cut half price", totalSteps: 8, stampsCount: 3,
    stampIcon: "sparkles", bgColor: "#eef1f5", accentColor: "#1e2a44", textColor: "#1e2a44",
    rewards: [{ step: 5, label: "-50%" }, { step: 8, label: "FREE" }], businessName: "MILAN FRISØR",
  },
  {
    title: "Vinbar 22", subtitle: "Glass on us at 6", totalSteps: 6, stampsCount: 2,
    stampIcon: "wine", bgColor: "#2a1a24", accentColor: "#e8b4c0", textColor: "#f5e6ea",
    rewards: [{ step: 6, label: "FREE" }], businessName: "VINBAR 22",
  },
];

function ForCustomersPage() {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrent(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    const id = window.setInterval(() => {
      carouselApi.scrollNext();
    }, 3200);
    return () => window.clearInterval(id);
  }, [carouselApi]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <span className="font-display text-xl font-semibold">Stempel</span>
        </Link>
        <Link to="/auth">
          <Button size="sm">Open my wallet</Button>
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
              Never lose a punch card again.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Stempel turns every paper loyalty card into a digital one that
              lives on your phone. Collect stamps, track rewards, and enjoy the
              perks of being a regular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8">
                  Open my wallet
                </Button>
              </Link>
              <Link to="/for-business">
                <Button size="lg" variant="outline" className="h-12 px-8">
                  I run a business
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto lg:max-w-xl"
          >
            <div className="rounded-3xl border border-border/60 bg-secondary/20 py-3 sm:py-5">
              <Carousel setApi={setCarouselApi} opts={{ align: "center", loop: true }} className="relative">
                <CarouselContent className="-ml-0">
                  {customerStackCards.map((card, idx) => (
                    <CarouselItem key={`${card.title}-${idx}`} className="pl-2 basis-[78%] sm:pl-3 sm:basis-[82%]">
                      <div className="mx-auto w-full max-w-[290px] sm:max-w-[420px]">
                        <StampCard {...card} disableShadow />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              <div className="mt-3 flex items-center justify-center sm:mt-4">
                <div className="flex items-center gap-1.5 sm:gap-2" role="tablist" aria-label="Card pages">
                  {customerStackCards.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`h-2.5 rounded-full transition-all ${current === i ? "w-6 bg-primary" : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"}`}
                      onClick={() => carouselApi?.scrollTo(i)}
                      aria-label={`Go to card ${i + 1}`}
                      aria-current={current === i}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <section className="mt-24">
          <div className="mb-12 text-center">
            <OrnamentDivider className="mx-auto mb-5 w-32" />
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Why customers love Stempel
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
