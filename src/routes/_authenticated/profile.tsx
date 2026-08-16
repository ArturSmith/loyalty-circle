import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, LogOut, Store, Loader2, HelpCircle, Mail, CreditCard, ChevronRight, Ticket } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useProfile } from "@/hooks/useProfile";
import { AVATAR_BUCKET, initialsFrom, resolveAvatarUrl } from "@/lib/avatar";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ClubCarder" },
      { name: "description", content: "Manage your ClubCarder account details, profile picture and display name." },
      { property: "og:title", content: "Your profile — ClubCarder" },
      { property: "og:description", content: "Manage your ClubCarder account details and profile picture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { profile, loading, reload } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setAvatarUrl(profile.avatarUrl);
    setAvatarPath(profile.avatarPath);
  }, [profile]);

  const onPickFile = async (file: File) => {
    if (!profile) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }

    const { error: saveError } = await supabase
      .from("profiles")
      .upsert({ id: profile.id, avatar_url: path, updated_at: new Date().toISOString() });
    if (saveError) { setUploading(false); toast.error(saveError.message); return; }

    if (avatarPath && !/^https?:/i.test(avatarPath)) {
      await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    }
    setAvatarPath(path);
    setAvatarUrl(await resolveAvatarUrl(path));
    setUploading(false);
    toast.success("Profile picture updated");
    reload();
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: profile.id,
      display_name: displayName || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); reload(); }
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <header className="px-5 py-4">
        <h1 className="font-display text-2xl font-semibold">Profile</h1>
      </header>

      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        {loading || !profile ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : (
          <>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative h-24 w-24 rounded-full overflow-hidden glass-panel border border-border flex items-center justify-center text-2xl font-display font-bold"
                aria-label="Upload profile picture"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Your profile picture" className="h-full w-full object-cover" />
                ) : (
                  <span>{initialsFrom(displayName, profile.email)}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/45 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                  {uploading ? "" : "Change"}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }}
              />
              <p className="mt-3 font-display text-xl font-semibold">{displayName || "Your name"}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>

            <OrnamentDivider className="w-32 mx-auto opacity-60 my-7" />

            <section className="rounded-2xl glass-panel p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Account details</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Row label="Full name" value={profile.displayName || "—"} />
                <Row label="Email" value={profile.email} />
                <Row label="Date of birth" value={fmt(profile.dateOfBirth)} />
                <Row label="Member since" value={fmt(profile.createdAt)} />
                <Row
                  label="Account type"
                  value={profile.hasBusiness ? `Business — ${profile.businessName}` : "Customer"}
                />
              </dl>
              {profile.hasBusiness && (
                <Link to="/business" className="mt-4 block">
                  <Button variant="outline" className="w-full gap-2">
                    <Store className="h-4 w-4" /> Business dashboard
                  </Button>
                </Link>
              )}
            </section>

            <div className="mt-6 space-y-5">
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="mt-1.5" />
              </div>
              <Button onClick={save} disabled={saving} className="w-full h-11">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>

            <nav className="mt-8 overflow-hidden rounded-2xl border border-border divide-y divide-border" aria-label="Account menu">
              <MenuLink to="/vouchers" icon={Ticket} label="My vouchers" />
              <MenuLink to="/settings/billing" icon={CreditCard} label="Settings & billing" />
              <MenuLink to="/help" icon={HelpCircle} label="Help" />
              <MenuLink to="/contact" icon={Mail} label="Contact us" />
            </nav>

            <Button variant="ghost" onClick={signOut} className="mt-6 w-full gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function MenuLink({ to, icon: Icon, label }: { to: string; icon: typeof Store; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-secondary">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}
