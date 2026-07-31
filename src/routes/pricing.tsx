import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SELLER_NAME, SUPPORT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — ClubCarder digital loyalty cards" },
      { name: "description", content: "ClubCarder is free for customers. Businesses get a 14-day free trial, then $19/month for unlimited cards, stamps, and customers." },
      { property: "og:title", content: "Pricing — ClubCarder" },
      { property: "og:description", content: "Free for customers. $19/month for businesses after a 14-day free trial." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://clubcarder.com/pricing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://clubcarder.com/pricing" }],
  }),
  component: PricingPage,
});

const businessFeatures = [
  "Unlimited stamp cards and card designs",
  "Unlimited customers and stamps",
  "Your own business QR code for sign-ups",
  "Scan-to-stamp from any phone — no hardware",
  "Rewards at any step, custom colors, shapes and icons",
  "Card analytics: who holds your cards and how close they are to a reward",
  "Email support",
];

const customerFeatures = [
  "All your loyalty cards in one wallet",
  "Scan a shop's QR to collect their card",
  "Live stamp progress and reward tracking",
  "No app to install",
];

function PricingPage() {
  return (
    <div className="relative min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-lg font-semibold">ClubCarder</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Free for customers, forever. One flat plan for businesses — no setup fees, no per-stamp charges, cancel any
            time.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="glass-panel rounded-2xl p-7">
            <h2 className="font-display text-xl font-semibold">For customers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Collect and keep your loyalty cards.</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold">Free</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm">
              {customerFeatures.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth" className="mt-7 block">
              <Button variant="outline" size="lg" className="h-12 w-full">Open my wallet</Button>
            </Link>
          </div>

          <div className="glass-panel rounded-2xl border-primary/40 p-7 ring-1 ring-primary/30">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Business</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                14-day free trial
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Run your own loyalty program.</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold">$19</span>
              <span className="text-sm text-muted-foreground">USD / month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Billed monthly. Taxes may apply depending on your country.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {businessFeatures.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth" className="mt-7 block">
              <Button size="lg" className="h-12 w-full">Start free trial</Button>
            </Link>
          </div>
        </div>

        <section className="mt-16 space-y-6 text-sm text-muted-foreground">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">What happens after the trial?</h2>
            <p className="mt-2">
              Your 14-day trial needs no payment up front. When it ends, keep going for $19/month — or do nothing and
              stamping simply pauses. Your cards and customers stay safe, and cardholders can still redeem rewards they
              have already earned.
            </p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Can I cancel?</h2>
            <p className="mt-2">
              Yes, any time from your billing settings. We also offer a 30-day money-back guarantee — see our{" "}
              <Link to="/refunds" className="text-primary underline">Refund Policy</Link>.
            </p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Who am I buying from?</h2>
            <p className="mt-2">
              ClubCarder is operated by {SELLER_NAME}. Our order process is conducted by our online reseller Paddle.com,
              the Merchant of Record for all our orders. Questions? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-12 text-center text-xs text-muted-foreground">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/refunds" className="hover:text-foreground">Refunds</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </div>
        © {SELLER_NAME}
      </footer>
    </div>
  );
}
