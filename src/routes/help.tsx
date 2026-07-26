import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft, CreditCard, QrCode, Wallet, Store, Gift, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/help")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Help Center — Clubcarder" },
      { name: "description", content: "Answers to common questions about Clubcarder digital loyalty cards for businesses and customers." },
      { property: "og:title", content: "Help Center — Clubcarder" },
      { property: "og:description", content: "How Clubcarder works — for businesses designing loyalty cards and customers collecting stamps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  {
    icon: Wallet,
    q: "How do I collect stamps?",
    a: "Scan a business's Clubcarder QR code to add their card to your wallet. On each visit, show the card's QR code to the business — they scan it and your stamp is added instantly.",
  },
  {
    icon: Gift,
    q: "How do I claim a reward?",
    a: "Once you fill in all steps on a card, the reward becomes available. Show your completed card at the business to redeem it, then tap 'Renew card' to start over.",
  },
  {
    icon: Store,
    q: "How do I create a loyalty card for my business?",
    a: "Sign up, start a Business account (14-day free trial), open the dashboard and tap 'New card'. Set your titles, colors and icon, choose the number of steps, and add rewards.",
  },
  {
    icon: QrCode,
    q: "How do customers find my cards?",
    a: "Every business has a shareable QR code on the dashboard. Print it, display it at your counter, or share the link — customers scan it to see and add your cards.",
  },
  {
    icon: CreditCard,
    q: "What happens if I stop my subscription?",
    a: "Existing customers keep their cards and can still redeem rewards they've earned. New stamps pause until you resume your subscription.",
  },
  {
    icon: ShieldCheck,
    q: "Is my data safe?",
    a: "Yes. Only you can see your own wallet, and businesses can only see stamps for their own cards. Stamps can't be forged — they're recorded server-side when scanned.",
  },
];

function HelpPage() {
  return (
    <div className="relative min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2"><Logo className="h-8 w-8" /><span className="font-display text-lg font-semibold">Clubcarder</span></Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Help Center</h1>
        <p className="mt-3 text-muted-foreground">Quick answers about using Clubcarder. Can't find what you need? <Link to="/contact" className="underline">Contact us</Link>.</p>

        <div className="mt-10 space-y-4">
          {faqs.map(({ icon: Icon, q, a }) => (
            <div key={q} className="rounded-2xl border border-border/70 bg-secondary/30 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">{q}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
