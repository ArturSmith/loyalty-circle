import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact Us — ClubCarder" },
      { name: "description", content: "Get in touch with the ClubCarder team for support, sales, or feedback about our digital loyalty card platform." },
      { property: "og:title", content: "Contact Us — ClubCarder" },
      { property: "og:description", content: "Reach out to ClubCarder — we're happy to help businesses and customers alike." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  message: z.string().trim().min(5, "Message is too short").max(2000),
});

const SUPPORT_EMAIL = "support@clubcarder.com";

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ name, email, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    const subject = encodeURIComponent(`ClubCarder — message from ${parsed.data.name}`);
    const body = encodeURIComponent(`${parsed.data.message}\n\n—\nFrom: ${parsed.data.name} <${parsed.data.email}>`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setTimeout(() => setSending(false), 800);
  };

  return (
    <div className="relative min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2"><Logo className="h-8 w-8" /><span className="font-display text-lg font-semibold">ClubCarder</span></Link>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </header>

      <main className="mx-auto grid max-w-4xl gap-10 px-6 pb-24 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Contact us</h1>
          <p className="mt-3 text-muted-foreground">
            Questions, feedback, or need a hand setting up? We're here to help.
          </p>

          <div className="mt-8 space-y-4">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-4 hover:bg-secondary/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Email</div>
                <div className="text-sm text-muted-foreground">{SUPPORT_EMAIL}</div>
              </div>
            </a>
            <Link to="/help" className="flex items-center gap-3 rounded-2xl border border-border/70 bg-secondary/30 p-4 hover:bg-secondary/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Help Center</div>
                <div className="text-sm text-muted-foreground">Common questions & how-tos</div>
              </div>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border/70 bg-secondary/30 p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Jane Doe" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} placeholder="jane@example.com" />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={6} placeholder="How can we help?" />
            </div>
            <Button type="submit" disabled={sending} className="w-full h-11">
              {sending ? "Opening email…" : "Send message"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">This opens your email app pre-filled to {SUPPORT_EMAIL}.</p>
          </div>
        </form>
      </main>
    </div>
  );
}
