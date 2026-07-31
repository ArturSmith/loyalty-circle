import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ClubCarder" }] }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/wallet">
          <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="font-display text-2xl font-semibold">Profile</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : (
          <>
            <OrnamentDivider className="w-32 mx-auto opacity-60" />
            <div className="mt-8 space-y-5">
              <div>
                <Label>Email</Label>
                <Input value={email} disabled className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="mt-1.5" />
              </div>
              <Button onClick={save} disabled={saving} className="w-full h-11">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="ghost" onClick={signOut} className="w-full gap-2 text-muted-foreground">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
