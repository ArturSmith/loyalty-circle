import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { ArrowLeft, Trash2 } from "lucide-react";

type Tpl = {
  id: string; business_id: string; title: string; subtitle: string | null;
  total_steps: number; shape: CardShape; bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[]; active: boolean;
};

export const Route = createFileRoute("/_authenticated/business/cards/$id/edit")({
  head: () => ({ meta: [{ title: "Edit card — Stempel" }] }),
  component: EditCard,
});

function EditCard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("card_templates").select("*").eq("id", id).maybeSingle();
      setTpl(data as Tpl | null);
    })();
  }, [id]);

  if (!tpl) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  const patch = (p: Partial<Tpl>) => setTpl({ ...tpl, ...p });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("card_templates").update({
      title: tpl.title, subtitle: tpl.subtitle, active: tpl.active, logo_url: tpl.logo_url, rewards: tpl.rewards,
    }).eq("id", tpl.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    navigate({ to: "/business" });
  };

  const remove = async () => {
    if (!confirm("Delete this card? Customer instances will also be removed.")) return;
    const { error } = await supabase.from("card_templates").delete().eq("id", tpl.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    navigate({ to: "/business" });
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-display text-2xl font-semibold">Edit card</h1>
      </header>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4">
        <StampCard title={tpl.title} subtitle={tpl.subtitle} totalSteps={tpl.total_steps} stampsCount={Math.floor(tpl.total_steps / 3)}
          shape={tpl.shape} bgColor={tpl.bg_color} accentColor={tpl.accent_color} textColor={tpl.text_color}
          stampIcon={tpl.stamp_icon} logoUrl={tpl.logo_url} rewards={tpl.rewards} businessName="PREVIEW" />
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card paper-grain p-6 space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={tpl.title} onChange={(e) => patch({ title: e.target.value })} />
        </div>
        <div>
          <Label>Subtitle</Label>
          <Input value={tpl.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value || null })} />
        </div>
        <div>
          <Label>Logo URL</Label>
          <Input value={tpl.logo_url ?? ""} onChange={(e) => patch({ logo_url: e.target.value || null })} />
        </div>
        <div>
          <Label>Rewards</Label>
          {tpl.rewards.map((r, i) => (
            <div key={i} className="mt-2 flex items-center gap-2">
              <Input type="number" min={1} max={tpl.total_steps} value={r.step}
                onChange={(e) => patch({ rewards: tpl.rewards.map((x, j) => j === i ? { ...x, step: Number(e.target.value) } : x) })} className="w-20" />
              <Input value={r.label} onChange={(e) => patch({ rewards: tpl.rewards.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <Button variant="ghost" size="icon" onClick={() => patch({ rewards: tpl.rewards.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => patch({ rewards: [...tpl.rewards, { step: tpl.total_steps, label: "" }] })}>Add reward</Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Active</Label>
            <p className="text-xs text-muted-foreground">Customers can only claim active cards.</p>
          </div>
          <Switch checked={tpl.active} onCheckedChange={(v) => patch({ active: v })} />
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
