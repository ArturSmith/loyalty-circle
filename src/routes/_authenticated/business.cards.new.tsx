import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// slider no longer used
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { StampCard, STAMP_ICONS } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";

export const Route = createFileRoute("/_authenticated/business/cards/new")({
  head: () => ({ meta: [{ title: "New card — Stempel" }] }),
  component: NewCard,
});

const PRESETS = [
  { bg: "#faf7ee", accent: "#1a1a2e", text: "#1a1a2e" }, // paper/ink
  { bg: "#1a1a2e", accent: "#e6c777", text: "#faf7ee" }, // navy/gold
  { bg: "#f4e9d8", accent: "#5a3a1a", text: "#3a2410" }, // café
  { bg: "#f7d8d8", accent: "#8a1e3c", text: "#3a1020" }, // rose
  { bg: "#e8f0e6", accent: "#2f5c3a", text: "#152b1c" }, // sage
  { bg: "#1a1a1a", accent: "#f4d47c", text: "#faf7ee" }, // black gold
];

const SHAPES: { value: CardShape; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "ticket", label: "Ticket" },
];

const ICONS: StampIconName[] = ["scissors", "coffee", "sparkles", "star", "heart", "flame", "cookie", "wine"];

function NewCard() {
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("Loyalty Card");
  const [subtitle, setSubtitle] = useState("");
  const [totalSteps, setTotalSteps] = useState(10);
  const [shape, setShape] = useState<CardShape>("rounded");
  const [preset, setPreset] = useState(0);
  const [icon, setIcon] = useState<StampIconName>("scissors");
  const [logoUrl, setLogoUrl] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([{ step: 5, label: "-50%" }, { step: 10, label: "FREE" }]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: b } = await supabase.from("businesses").select("id").eq("owner_id", u.user.id).maybeSingle();
      if (!b) { navigate({ to: "/business" }); return; }
      setBusinessId((b as { id: string }).id);
    })();
  }, [navigate]);

  const { bg, accent, text } = PRESETS[preset];

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    const cleanRewards = rewards.filter((r) => r.step >= 1 && r.label.trim().length > 0);
    const { error } = await supabase.from("card_templates").insert({
      business_id: businessId, title, subtitle: subtitle || null,
      total_steps: totalSteps, shape, bg_color: bg, accent_color: accent, text_color: text,
      stamp_icon: icon, logo_url: logoUrl || null, rewards: cleanRewards, active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Card created");
    navigate({ to: "/business" });
  };

  const stepsLabels = ["Basics", "Style", "Steps & rewards", "Review"];
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const openStepEditor = (s: number) => {
    setEditingStep(s);
    setEditingLabel(rewards.find((r) => r.step === s)?.label ?? "");
  };
  const saveStepEditor = () => {
    if (editingStep == null) return;
    const others = rewards.filter((r) => r.step !== editingStep);
    const label = editingLabel.trim();
    setRewards(label ? [...others, { step: editingStep, label }].sort((a, b) => a.step - b.step) : others);
    setEditingStep(null);
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step === 0 ? navigate({ to: "/business" }) : setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Step {step + 1} / {stepsLabels.length}</p>
          <h1 className="font-display text-2xl font-semibold">{stepsLabels[step]}</h1>
        </div>
      </header>

      <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div className="h-full bg-ink" animate={{ width: `${((step + 1) / stepsLabels.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4">
        <StampCard title="Card title" subtitle="" totalSteps={totalSteps} stampsCount={0}
          shape={shape} bgColor={bg} accentColor={accent} textColor={text} stampIcon={icon}
          logoUrl={null} rewards={rewards} businessName="PREVIEW"
          hideSteps={step === 0}
          onStepClick={step === 2 ? openStepEditor : undefined}
          activeStep={editingStep ?? undefined} />
        {step === 2 && editingStep != null && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Benefit on step {editingStep}</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)}
                placeholder="e.g. -50%, FREE, ★"
                onKeyDown={(e) => { if (e.key === "Enter") saveStepEditor(); if (e.key === "Escape") setEditingStep(null); }} />
              <Button onClick={saveStepEditor} size="sm"><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingStep(null)}>Cancel</Button>
            </div>
          </div>
        )}
        {step === 2 && editingStep == null && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Tap any step above to set a benefit</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card paper-grain p-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="5 klipp -50%" />
                </div>
                <div>
                  <Label>Subtitle (optional)</Label>
                  <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="10 klipp gratis" />
                </div>
                <div>
                  <Label>Logo (SVG, optional)</Label>
                  <Input type="file" accept="image/svg+xml,.svg"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!f.type.includes("svg") && !f.name.toLowerCase().endsWith(".svg")) {
                        toast.error("Please upload an SVG file");
                        return;
                      }
                      const text = await f.text();
                      setLogoUrl(`data:image/svg+xml;utf8,${encodeURIComponent(text)}`);
                    }} />
                  {logoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={logoUrl} alt="logo" className="h-10 w-10 rounded-full ring-1 ring-black/10 bg-white p-1" />
                      <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remove</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label>Card shape</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {SHAPES.map((s) => (
                      <button key={s.value} type="button" onClick={() => setShape(s.value)}
                        className={`rounded-lg border-2 p-3 text-sm ${shape === s.value ? "border-ink bg-secondary" : "border-border"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Color</Label>
                  <div className="mt-2 grid grid-cols-6 gap-2">
                    {PRESETS.map((p, i) => (
                      <button key={i} type="button" onClick={() => setPreset(i)}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center ${preset === i ? "border-ink" : "border-transparent"}`}
                        style={{ backgroundColor: p.bg }}>
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: p.accent }} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Stamp icon</Label>
                  <div className="mt-2 grid grid-cols-8 gap-2">
                    {ICONS.map((name) => {
                      const I = STAMP_ICONS[name];
                      return (
                        <button key={name} type="button" onClick={() => setIcon(name)}
                          className={`aspect-square rounded-lg border-2 flex items-center justify-center ${icon === name ? "border-ink bg-secondary" : "border-border"}`}>
                          <I className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Total steps</Label>
                  <Input type="number" min={1} value={totalSteps}
                    onChange={(e) => setTotalSteps(Math.max(1, Number(e.target.value) || 1))} className="mt-2 w-32" />
                </div>
                <p className="text-sm text-muted-foreground">Tap a step on the preview above to set the benefit shown when the customer reaches it (e.g. "-50%" on step 5, "FREE" on step 10).</p>
              </div>
            )}
            {step === 3 && (
              <div className="text-center space-y-3">
                <OrnamentDivider className="w-32 mx-auto opacity-60" />
                <h3 className="font-display text-xl">Looks good?</h3>
                <p className="text-sm text-muted-foreground">You can edit anything later from the dashboard.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => step === 0 ? navigate({ to: "/business" }) : setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < stepsLabels.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} disabled={saving}><Check className="h-4 w-4" /> {saving ? "Creating…" : "Create card"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RewardsEditor({ rewards, setRewards, totalSteps }: { rewards: Reward[]; setRewards: (r: Reward[]) => void; totalSteps: number }) {
  return (
    <div className="space-y-3">
      <Label>Rewards on specific steps</Label>
      <p className="text-xs text-muted-foreground">The number that appears in that circle before it's stamped. Example: step 10 = "FREE".</p>
      {rewards.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="number" min={1} value={r.step}
            onChange={(e) => setRewards(rewards.map((x, j) => j === i ? { ...x, step: Number(e.target.value) } : x))} className="w-20" />
          <Input value={r.label}
            onChange={(e) => setRewards(rewards.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="-50%" />
          <Button variant="ghost" size="icon" onClick={() => setRewards(rewards.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setRewards([...rewards, { step: totalSteps, label: "" }])}>
        <Plus className="h-4 w-4" /> Add reward
      </Button>
    </div>
  );
}
