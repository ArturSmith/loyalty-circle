import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() }).catch({ redirect: undefined });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Stempel" }, { name: "description", content: "Sign in to collect stamps and manage your loyalty cards." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const goNext = () => {
    if (redirect && redirect.startsWith("/")) navigate({ to: redirect });
    else navigate({ to: "/wallet" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Sign-in failed. Try again."); return; }
    if (result.redirected) return;
    goNext();
  };

  const handleApple = async () => {
    const result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Sign-in failed. Try again."); return; }
    if (result.redirected) return;
    goNext();
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + (redirect ?? "/wallet") },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8"
      >
        <div className="relative flex flex-col items-center text-center">
          <Link
            to="/"
            className="absolute left-0 top-0 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <OrnamentDivider className="my-3 w-32" />
          <h1 className="font-display text-3xl font-semibold">Welcome to Stempel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to collect stamps and unlock rewards.</p>
        </div>

        <div className="mt-8 space-y-3">
          <Button onClick={handleGoogle} className="w-full h-11" variant="outline">
            <GoogleIcon /> Continue with Google
          </Button>
          <Button onClick={handleApple} className="w-full h-11" variant="outline">
            <AppleIcon /> Continue with Apple
          </Button>

          <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          {sent ? (
            <div className="rounded-lg bg-secondary p-4 text-center text-sm">
              Check your inbox — we sent a magic link to <strong>{email}</strong>.
            </div>
          ) : (
            <form onSubmit={handleMagic} className="space-y-3">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              <Button type="submit" disabled={sending} className="w-full h-11">
                {sending ? "Sending link…" : "Email me a sign-in link"}
              </Button>
            </form>
          )}
        </div>

        <OrnamentDivider className="mt-8 w-full opacity-60" />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to fair use of our stamp cards.
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.85 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.67-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.79 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.22 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}
