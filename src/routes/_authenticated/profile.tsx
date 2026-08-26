import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageLoader, Spinner } from "@/components/Spinner";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { postSignOutDestination } from "@/lib/post-sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, LogOut, Store, HelpCircle, Mail, CreditCard, ChevronRight, Building2, Copy, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { QrDisplay } from "@/components/QrDisplay";
import { customerQrValue, shortCustomerCode } from "@/lib/customer-code";
import { useProfile } from "@/hooks/useProfile";
import type { ProfileInfo } from "@/hooks/useProfile";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { AVATAR_BUCKET, initialsFrom, resolveAvatarUrl } from "@/lib/avatar";
import { TabScreen } from "@/components/TabScreen";

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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers; the id is shown in full
      // below the code so it can still be selected by hand.
      toast.error("Couldn't copy — select the ID below instead");
    }
  };

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    // <input type="date"> needs a bare YYYY-MM-DD, but the stored value may be
    // a full timestamp.
    setDateOfBirth((profile.dateOfBirth ?? "").slice(0, 10));
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
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Date of birth lives in the auth user's metadata rather than the profiles
    // table, so it needs a second call.
    if (dateOfBirth !== (profile.dateOfBirth ?? "").slice(0, 10)) {
      const { error: dobError } = await supabase.auth.updateUser({
        data: { date_of_birth: dateOfBirth || null },
      });
      if (dobError) { setSaving(false); toast.error(dobError.message); return; }
    }

    setSaving(false);
    toast.success("Profile saved");
    setEditing(false);
    reload();
  };

  const cancelEdit = () => {
    // Discard the draft, not just the form.
    setDisplayName(profile?.displayName ?? "");
    setDateOfBirth((profile?.dateOfBirth ?? "").slice(0, 10));
    setEditing(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: postSignOutDestination(), replace: true }); };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <TabScreen title="Profile">
      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        {loading || !profile ? (
          <PageLoader />
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
                  {uploading ? <Spinner size={12} label={null} className="text-white" /> : <Camera className="h-3 w-3" />}
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
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Account details</h2>
                {!editing && (
                  <Button variant="ghost" size="sm" className="-mr-2 h-7 gap-1.5 px-2" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                {/* The editable rows swap their value for a field in place, so
                    the layout stays put instead of growing a second form. */}
                <Row label="Full name">
                  {editing ? (
                    <Input
                      aria-label="Full name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="h-8 text-right"
                      autoFocus
                    />
                  ) : (
                    profile.displayName || "—"
                  )}
                </Row>
                <Row label="Email">{profile.email}</Row>
                <Row label="Date of birth">
                  {editing ? (
                    <Input
                      aria-label="Date of birth"
                      type="date"
                      value={dateOfBirth}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="h-8 text-right"
                    />
                  ) : (
                    fmt(profile.dateOfBirth)
                  )}
                </Row>
                <Row label="Member since">{fmt(profile.createdAt)}</Row>
              </dl>
              {editing && (
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving} className="flex-1">
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </section>

            <BusinessSection profile={profile} />

            <section className="mt-6 rounded-2xl glass-panel p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your ID</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Show this to a business so they can find you without searching by name.
              </p>

              <div className="mt-4 flex justify-center">
                <div className="rounded-2xl bg-white p-3">
                  <QrDisplay value={customerQrValue(profile.id)} size={180} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Short code</p>
                  <p className="font-mono text-lg font-semibold tracking-wider">{shortCustomerCode(profile.id)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => copyId(profile.id)}
                  aria-label="Copy your full ID"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy ID"}
                </Button>
              </div>
              <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{profile.id}</p>
            </section>

            <nav className="mt-8 overflow-hidden rounded-2xl border border-border divide-y divide-border" aria-label="Account menu">
              <MenuLink to="/help" icon={HelpCircle} label="Help" />
              <MenuLink to="/contact" icon={Mail} label="Contact us" />
            </nav>

            <Button variant="ghost" onClick={signOut} className="mt-6 w-full gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </>
        )}
      </div>
    </TabScreen>
  );
}

/**
 * What this account's relationship to a business actually is: whether they own
 * one, how it's being paid for, and anything that needs their attention.
 *
 * Kept in its own component so the subscription lookup only runs here, and the
 * rest of the profile still renders while it's in flight.
 */
function BusinessSection({ profile }: { profile: ProfileInfo }) {
  const access = useBusinessAccess();

  if (!profile.hasBusiness) {
    return (
      <section className="mt-6 rounded-2xl glass-panel p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Business</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't run a business on ClubCarder yet. Create loyalty cards, stamp them by QR and see who keeps
          coming back.
        </p>
        <Link to="/business" className="mt-4 block">
          <Button className="w-full gap-2">
            <Building2 className="h-4 w-4" /> ClubCarder enterprise
          </Button>
        </Link>
      </section>
    );
  }

  if (profile.businessRole === "admin") {
    return (
      <section className="mt-6 rounded-2xl glass-panel p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Business</h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <Row label="Your role">Administrator</Row>
          <Row label="Business">{profile.businessName ?? "—"}</Row>
        </dl>
        <Link to="/business" className="mt-4 block">
          <Button variant="outline" className="w-full gap-2">
            <Store className="h-4 w-4" /> Open dashboard
          </Button>
        </Link>
      </section>
    );
  }

  const plan = access.loading
    ? "Checking…"
    : access.isPastDue
      ? "Payment failed"
      : access.uncoveredCount > 0
        ? access.reason === "trial-expired"
          ? "Trial ended"
          : "Needs more seats"
        : access.isSubscribed
          ? access.cancelAtPeriodEnd
            ? "Cancels at period end"
            : "Subscribed"
          : access.trialDaysLeft !== null
            ? `Trial — ${access.trialDaysLeft} ${access.trialDaysLeft === 1 ? "day" : "days"} left`
            : "Trial";

  // Anything that stops stamping, or will soon, is worth surfacing here rather
  // than leaving the owner to discover it at the counter.
  const needsAttention = !access.loading && (access.isPastDue || access.uncoveredCount > 0);

  return (
    <section className="mt-6 rounded-2xl glass-panel p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Business</h2>
      <dl className="mt-3 space-y-2.5 text-sm">
        <Row label="Your role">Owner</Row>
        <Row label={access.businessCount > 1 ? "Businesses" : "Business"}>
          {access.businessCount > 1
            ? `${profile.businessName} +${access.businessCount - 1} more`
            : profile.businessName ?? "—"}
        </Row>
        <Row label="Plan">{plan}</Row>
        {!access.loading && access.seatCount > 0 && (
          <Row label="Seats">{`${access.seatCount} active`}</Row>
        )}
      </dl>

      {needsAttention && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {access.isPastDue
            ? "Your last payment failed. Update your card to keep stamping."
            : `${access.uncoveredCount} of your businesses ${access.uncoveredCount === 1 ? "isn't" : "aren't"} covered — stamping is paused for ${access.uncoveredCount === 1 ? "it" : "them"}.`}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/business">
          <Button variant="outline" className="w-full gap-2">
            <Store className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Link to="/settings/billing">
          <Button variant={needsAttention ? "default" : "outline"} className="w-full gap-2">
            <CreditCard className="h-4 w-4" /> Billing
          </Button>
        </Link>
      </div>
    </section>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-8">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 text-right font-medium break-words">{children}</dd>
    </div>
  );
}
