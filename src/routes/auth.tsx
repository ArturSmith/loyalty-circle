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
import { getDefaultHome } from "@/lib/defaultHome";

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

  // If an explicit redirect was requested, honor it. Otherwise let __root
  // route the user to /business or /wallet based on account type once the
  // session is available.
  const goNext = () => {
    if (explicitRedirect) navigate({ to: explicitRedirect });
  };

  const stashRedirect = () => {
    if (!explicitRedirect) return;
    try { sessionStorage.setItem("post_auth_redirect", explicitRedirect); } catch {}
  };



  const handleGoogle = async () => {
    stashRedirect();
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
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
        <Button variant="ghost" className="mb-3 -ml-2 gap-2 text-muted-foreground" asChild>
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
...
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
