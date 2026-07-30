import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AppBar } from "@/components/AppBar";

type Business = { id: string; name: string; logo_url: string | null; brand_color: string | null };

export const Route = createFileRoute("/_authenticated/business/edit")({
  head: () => ({ meta: [{ title: "Edit business — Clubcarder" }] }),
  component: EditBusiness,
});

function EditBusiness() {
  const navigate = useNavigate();
  const [biz, setBiz] = useState<Business | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("businesses").select("*").eq("owner_id", u.user.id).maybeSingle();
      const b = data as Business | null;
      setBiz(b);
      if (b) {
        setName(b.name);
        setLogoUrl(b.logo_url ?? "");
        setBrandColor(b.brand_color ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biz) return;
    setSaving(true);
    const { error } = await supabase.from("businesses").update({
      name,
      logo_url: logoUrl || null,
      brand_color: brandColor || null,
      updated_at: new Date().toISOString(),
    }).eq("id", biz.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Business updated");
    navigate({ to: "/business" });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!biz) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No business found.</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <AppBar variant="simple" title="Edit business" backHref="/business" />

      <form onSubmit={save} className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        <div className="space-y-5">
          <div>
            <Label htmlFor="name">Business name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="color">Brand color</Label>
            <div className="mt-1.5 flex gap-2">
              <Input id="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#7c3aed" />
              <input type="color" value={brandColor || "#7c3aed"} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-14 rounded-md border border-input" />
            </div>
          </div>
          <Button type="submit" disabled={saving || !name} className="w-full h-11">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
