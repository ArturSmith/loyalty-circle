import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageLoader, Spinner } from "@/components/Spinner";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { postSignOutDestination } from "@/lib/post-sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, LogOut, Store, HelpCircle, Mail, ChevronRight, Building2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useProfile } from "@/hooks/useProfile";
import type { ProfileInfo } from "@/hooks/useProfile";
import { AVATAR_BUCKET, initialsFrom, resolveAvatarUrl } from "@/lib/avatar";
import { TabScreen } from "@/components/TabScreen";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/utils/admin.functions";
import { LanguageSwitcher } from "@/i18n";
import { CustomerQrCard } from "@/components/CustomerQrCard";

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): { edit?: boolean; businessSubmitted?: boolean } => ({
    edit: search.edit === true || search.edit === "true" || search.edit === "1" ? true : undefined,
    businessSubmitted: search.businessSubmitted === true || search.businessSubmitted === "true" ? true : undefined,
  }),
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
  const { edit: openEditor, businessSubmitted } = Route.useSearch();
  const { profile, loading, reload } = useProfile();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isStaffAdmin, setIsStaffAdmin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const checkStaffAdmin = useServerFn(amIAdmin);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setEmail(profile.email ?? "");
    // <input type="date"> needs a bare YYYY-MM-DD, but the stored value may be
    // a full timestamp.
    setDateOfBirth((profile.dateOfBirth ?? "").slice(0, 10));
    setAvatarUrl(profile.avatarUrl);
    setAvatarPath(profile.avatarPath);
  }, [profile]);

  useEffect(() => {
    if (openEditor) setEditing(true);
  }, [openEditor]);

  useEffect(() => {
    checkStaffAdmin({}).then((result) => setIsStaffAdmin(result.admin)).catch(() => setIsStaffAdmin(false));
    // The server-function wrapper is recreated by the hook; this check only
    // belongs to the page mount, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .update({ avatar_url: path, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
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
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Date of birth lives in the auth user's metadata rather than the profiles
    // table, so it needs a second call.
    if (dateOfBirth !== (profile.dateOfBirth ?? "").slice(0, 10)) {
      const { error: dobError } = await supabase.auth.updateUser({
        data: { date_of_birth: dateOfBirth || null },
      });
      if (dobError) { setSaving(false); toast.error(dobError.message); return; }
    }

    let emailConfirmationSent = false;
    if (normalizedEmail.toLowerCase() !== profile.email.trim().toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: normalizedEmail });
      if (emailError) { setSaving(false); toast.error(emailError.message); return; }
      emailConfirmationSent = true;
    }

    setSaving(false);
    toast.success(emailConfirmationSent ? "Check your email to confirm the new address." : "Profile saved");
    setEditing(false);
    reload();
  };

  const cancelEdit = () => {
    // Discard the draft, not just the form.
    setDisplayName(profile?.displayName ?? "");
    setEmail(profile?.email ?? "");
    setDateOfBirth((profile?.dateOfBirth ?? "").slice(0, 10));
    setEditing(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: postSignOutDestination(), replace: true }); };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <TabScreen title="Profile">
      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full md:max-w-5xl md:py-8">
        {businessSubmitted && (
          <section role="status" className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="font-semibold">Sent for moderation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your business and first loyalty card have been sent to moderators.</p>
            <Link to="/workspace" className="mt-3 inline-block text-sm font-medium text-primary">View in Workspace</Link>
          </section>
        )}
        {loading || !profile ? (
          <PageLoader />
        ) : (
          <div className="md:grid md:grid-cols-2 md:items-start md:gap-8 lg:gap-12">
            <div className="min-w-0">
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
                <Row label="Email">
                  {editing ? (
                    <Input
                      aria-label="Email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      className="h-8 text-right"
                      autoComplete="email"
                    />
                  ) : (
                    profile.email || "—"
                  )}
                </Row>
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

            </div>
            <div className="min-w-0">
            <BusinessSection profile={profile} />

            <section className="mt-6 flex items-center justify-between gap-4 rounded-2xl glass-panel p-4">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Language</h2>
                <p className="mt-1 text-sm text-muted-foreground">English or Norwegian Bokmål</p>
              </div>
              <LanguageSwitcher compact />
            </section>

            <CustomerQrCard
              qrToken={profile.customerQrToken}
              userId={profile.id}
              className="mt-6"
            />

            <nav className="mt-8 overflow-hidden rounded-2xl border border-border divide-y divide-border" aria-label="Account menu">
              {isStaffAdmin && <MenuLink to="/admin" icon={ShieldCheck} label="Platform moderation" />}
              <MenuLink to="/help" icon={HelpCircle} label="Help" />
              <MenuLink to="/contact" icon={Mail} label="Contact us" />
            </nav>

            <Button variant="ghost" onClick={signOut} className="mt-6 w-full gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
            </div>
          </div>
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
  if (!profile.hasBusiness) {
    return (
      <section className="mt-6 rounded-2xl glass-panel p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Business</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't run a business on ClubCarder yet. Create loyalty cards, stamp them by QR and see who keeps
          coming back.
        </p>
        <Link to="/business/onboarding" className="mt-4 block">
          <Button className="w-full gap-2">
            <Building2 className="h-4 w-4" /> ClubCarder enterprise
          </Button>
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl glass-panel p-4">
      <Link to="/workspace" className="block">
        <Button className="h-11 w-full gap-2">
          <Building2 className="h-4 w-4" /> Workspace
        </Button>
      </Link>
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
