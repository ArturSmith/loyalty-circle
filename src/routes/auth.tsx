import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() }).catch({ redirect: undefined });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — ClubCarder" }, { name: "description", content: "Sign in to collect stamps and manage your loyalty cards." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "signup" | "reset">("password");

  const explicitRedirect = redirect && redirect.startsWith("/") ? redirect : null;

  // If an explicit redirect was requested, honor it. Otherwise the root
  // auth-state handler sends the user to /wallet.
  const goNext = () => {
    if (explicitRedirect) navigate({ to: explicitRedirect });
  };

  const stashRedirect = () => {
    if (!explicitRedirect) return;
    try { sessionStorage.setItem("post_auth_redirect", explicitRedirect); } catch {}
  };



  const handleGoogle = async () => {
    stashRedirect();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      // Signing out of ClubCarder doesn't sign the user out of Google, so the
      // provider would otherwise wave them straight back in as whoever they
      // were last time — with no way to pick a different account, and no sign
      // that a choice was even made. Always show the account chooser.
      extraParams: { prompt: "select_account" },
    });
    if (result.error) { toast.error("Sign-in failed. Try again."); return; }
    if (result.redirected) return;
    goNext();
  };

  const handleApple = async () => {
    stashRedirect();
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

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    goNext();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    const name = fullName.trim();
    if (name.length < 2 || name.length > 80) { toast.error("Please enter your name (2–80 characters)"); return; }
    if (!dob) { toast.error("Please enter your date of birth"); return; }
    const dobDate = new Date(dob + "T00:00:00");
    if (Number.isNaN(dobDate.getTime())) { toast.error("Invalid date of birth"); return; }
    const now = new Date();
    const age = (now.getTime() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 13) { toast.error("You must be at least 13 years old"); return; }
    if (age > 120) { toast.error("Please enter a valid date of birth"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSending(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + (explicitRedirect ?? "/"),
        data: { full_name: name, date_of_birth: dob },
      },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) { goNext(); return; }
    setSignupEmail(email);
    setPassword(""); setConfirmPassword("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/reset-password",
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your inbox for password reset link");
    setMode("password");
    setEmail("");
  };

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Button variant="ghost" className="hide-in-app mb-3 -ml-2 gap-2 text-muted-foreground" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8"
        >
          <div className="flex flex-col items-center text-center">
            <Logo className="h-14 w-14 rotate-[-8deg] drop-shadow-md" />
            <OrnamentDivider className="my-3 w-32" />
            <h1 className="font-display text-3xl font-semibold">Welcome to ClubCarder</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to collect stamps and unlock rewards.</p>
          </div>

        <div className="mt-8 space-y-3">
          {signupEmail ? (
            <div className="rounded-xl border border-ink/10 bg-background/60 p-6 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint/30 text-accent-foreground">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 21.75 4.5H4.5A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Confirm your email</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="font-medium text-foreground">{signupEmail}</span>. Tap the link in the email to finish signing up.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => { setSignupEmail(null); setMode("password"); setEmail(""); }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <Button onClick={handleGoogle} className="w-full h-11" variant="outline">
                <GoogleIcon /> Continue with Google
              </Button>
              <Button onClick={handleApple} className="w-full h-11" variant="outline">
                <AppleIcon /> Continue with Apple
              </Button>

              <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              {mode === "password" && (
            <form onSubmit={handlePassword} className="space-y-3">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              <Input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
              <Button type="submit" disabled={sending} className="w-full h-11">
                {sending ? "Signing in…" : "Sign in"}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setMode("reset"); setPassword(""); setConfirmPassword(""); }}
                >
                  Forgot password?
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setMode("signup"); setPassword(""); setConfirmPassword(""); }}
                >
                  Create account
                </Button>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <Input
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11"
              />
              <div className="space-y-1">
                <label htmlFor="dob" className="px-1 text-xs text-muted-foreground">Date of birth</label>
                <Input
                  id="dob"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  autoComplete="bday"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="h-11"
                />
              </div>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
                aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
              />
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="-mt-2 text-xs text-destructive">Passwords don't match</p>
              )}
              <Button type="submit" disabled={sending} className="w-full h-11">
                {sending ? "Creating account…" : "Sign up"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => { setMode("password"); setPassword(""); setConfirmPassword(""); }}
              >
                Already have an account? Sign in
              </Button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
              <Button type="submit" disabled={sending} className="w-full h-11">
                {sending ? "Sending reset link…" : "Send password reset link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => { setMode("password"); setEmail(""); setPassword(""); setConfirmPassword(""); }}
              >
              Back to sign in
            </Button>
          </form>
          )}
        </>
      )}
    </div>

    <OrnamentDivider className="mt-8 w-full opacity-60" />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to fair use of our stamp cards.
        </p>
        </motion.div>
      </div>
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
