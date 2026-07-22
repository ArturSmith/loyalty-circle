import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { StampCard, STAMP_ICONS } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { ArrowLeft, ArrowRight, Check, Trash2 } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";

const PRESETS = [
  { bg: "#faf7ee", accent: "#1a1a2e", text: "#1a1a2e" },
  { bg: "#1a1a2e", accent: "#e6c777", text: "#faf7ee" },
  { bg: "#f4e9d8", accent: "#5a3a1a", text: "#3a2410" },
  { bg: "#f7d8d8", accent: "#8a1e3c", text: "#3a1020" },
  { bg: "#e8f0e6", accent: "#2f5c3a", text: "#152b1c" },
  { bg: "#1a1a1a", accent: "#f4d47c", text: "#faf7ee" },
];

const SHAPES: { value: CardShape; label: string }[] = [
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "ticket", label: "Ticket" },
];

const ICONS: StampIconName[] = ["scissors", "coffee", "sparkles", "star", "heart", "flame", "cookie", "wine"];

function matchPreset(bg: string, accent: string, text: string): number {
  const i = PRESETS.findIndex((p) => p.bg === bg && p.accent === accent && p.text === text);
  return i === -1 ? -1 : i;
}

type Props = { templateId?: string };

export function CardWizard({ templateId }: Props) {
  const isEdit = !!templateId;
  const navigate = useNavigate();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const [title, setTitle] = useState("Loyalty Card");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [cornerTitle, setCornerTitle] = useState<string | null>(null);
  const [totalSteps, setTotalSteps] = useState(10);
  const [shape, setShape] = useState<CardShape>("rounded");
  const [preset, setPreset] = useState<number>(0);
  const [customColors, setCustomColors] = useState<{ bg: string; accent: string; text: string } | null>(null);
  const [icon, setIcon] = useState<StampIconName | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [active, setActive] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: b } = await supabase.from("businesses").select("id").eq("owner_id", u.user.id).maybeSingle();
      if (!b) { navigate({ to: "/business" }); return; }
      setBusinessId((b as { id: string }).id);

      if (isEdit && templateId) {
        const { data: t } = await supabase.from("card_templates").select("*").eq("id", templateId).maybeSingle();
        if (t) {
          const tpl = t as {
            title: string; subtitle: string | null; description: string | null;
            corner_title: string | null;
            total_steps: number; shape: CardShape;
            bg_color: string; accent_color: string; text_color: string; stamp_icon: StampIconName;
            logo_url: string | null; rewards: Reward[] | null; active: boolean;
          };
          setTitle(tpl.title);
          setSubtitle(tpl.subtitle ?? "");
          setDescription(tpl.description ?? "");
          setCornerTitle(tpl.corner_title);
          setTotalSteps(tpl.total_steps);
          setShape(tpl.shape);
          const pi = matchPreset(tpl.bg_color, tpl.accent_color, tpl.text_color);
          if (pi >= 0) setPreset(pi);
          else setCustomColors({ bg: tpl.bg_color, accent: tpl.accent_color, text: tpl.text_color });
          setIcon(tpl.stamp_icon);
          setLogoUrl(tpl.logo_url ?? "");
          setRewards(tpl.rewards ?? []);
          setActive(tpl.active);
        }
        setLoading(false);
      }
    })();
  }, [navigate, isEdit, templateId]);

  const { bg, accent, text } = customColors ?? PRESETS[preset];

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    const cleanRewards = rewards.filter((r) => r.step >= 1 && r.step <= totalSteps && r.label.trim().length > 0);
    const payload = {
      title, subtitle: subtitle || null, description: description || null,
      corner_title: cornerTitle,
      total_steps: totalSteps, shape,
      bg_color: bg, accent_color: accent, text_color: text,
      stamp_icon: icon ?? "star", logo_url: logoUrl || null, rewards: cleanRewards, active,
    };
    const { error } = isEdit && templateId
      ? await supabase.from("card_templates").update(payload).eq("id", templateId)
      : await supabase.from("card_templates").insert({ business_id: businessId, ...payload });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Saved" : "Card created");
    navigate({ to: "/business" });
  };

  const remove = async () => {
    if (!isEdit || !templateId) return;
    if (!confirm("Delete this card? Customer instances will also be removed.")) return;
    const { error } = await supabase.from("card_templates").delete().eq("id", templateId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    navigate({ to: "/business" });
  };

  const stepsLabels = ["Basics", "Style", "Steps & rewards", "Review"];
  const face = step >= 2 ? "stamps" : "info";

  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingField, setEditingField] = useState<null | "title" | "subtitle" | "description" | "icon" | "cornerTitle">(null);

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

  const handleLogoUpload = async (f: File) => {
    if (!f.type.includes("svg") && !f.name.toLowerCase().endsWith(".svg")) {
      toast.error("Please upload an SVG file");
      return;
    }
    const svg = await f.text();
    setLogoUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    setIcon(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step === 0 ? navigate({ to: "/business" }) : setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Step {step + 1} / {stepsLabels.length}{isEdit ? " · Editing" : ""}</p>
          <h1 className="font-display text-2xl font-semibold">{stepsLabels[step]}</h1>
        </div>
        {isEdit && (
          <Button variant="ghost" size="icon" className="text-destructive" onClick={remove} title="Delete card">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div className="h-full bg-ink" animate={{ width: `${((step + 1) / stepsLabels.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4">
        <StampCard title={title || "Card title"} subtitle={subtitle} description={description}
          totalSteps={totalSteps} stampsCount={0}
          shape={shape} face={face}
          bgColor={bg} accentColor={accent} textColor={text} stampIcon={icon}
          logoUrl={logoUrl || null} rewards={rewards}
          onStepClick={step === 2 ? openStepEditor : undefined}
          activeStep={editingStep ?? undefined}
          onTitleClick={step < 2 ? () => { setEditingStep(null); setEditingField("title"); } : undefined}
          onSubtitleClick={step < 2 ? () => { setEditingStep(null); setEditingField("subtitle"); } : undefined}
          onDescriptionClick={step < 2 ? () => { setEditingStep(null); setEditingField("description"); } : undefined}
          onIconClick={step < 2 ? () => { setEditingStep(null); setEditingField("icon"); } : undefined} />

        {editingField === "title" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Title</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }} />
              <Button size="sm" onClick={() => setEditingField(null)}><Check className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        {editingField === "subtitle" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Subtitle</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Optional"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }} />
              <Button size="sm" onClick={() => setEditingField(null)}><Check className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        {editingField === "description" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Description</Label>
            <div className="mt-2 flex flex-col gap-2">
              <Textarea autoFocus value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown on the card front" rows={3} />
              <Button size="sm" onClick={() => setEditingField(null)} className="self-end"><Check className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        {editingField === "icon" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3 space-y-3">
            <div>
              <Label className="text-xs">Choose icon</Label>
              <div className="mt-2 grid grid-cols-8 gap-2">
                {ICONS.map((name) => {
                  const I = STAMP_ICONS[name];
                  return (
                    <button key={name} type="button"
                      onClick={() => { setIcon(name); setLogoUrl(""); }}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center bg-background ${icon === name && !logoUrl ? "border-ink" : "border-border"}`}>
                      <I className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs">Or upload SVG logo</Label>
              <Input type="file" accept="image/svg+xml,.svg" className="mt-2"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleLogoUpload(f); }} />
              {logoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={logoUrl} alt="logo" className="h-8 w-8 rounded-full ring-1 ring-black/10 bg-white p-0.5" />
                  <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remove</Button>
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}>Done</Button>
          </div>
        )}

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
          totalSteps > 0 ? (
            <p className="mt-3 text-center text-sm font-medium text-ink animate-pulse">Tap on step to set rewards</p>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">No steps configured. Increase total steps to add rewards.</p>
          )
        )}
        {step < 2 && editingField == null && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Tap the title, subtitle, description or icon on the card to edit</p>
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
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="A little context shown on the card front" rows={3} />
                </div>
                <div>
                  <Label>Logo (SVG, optional)</Label>
                  <Input type="file" accept="image/svg+xml,.svg"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleLogoUpload(f); }} />
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
                      <button key={i} type="button" onClick={() => { setPreset(i); setCustomColors(null); }}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center ${!customColors && preset === i ? "border-ink" : "border-transparent"}`}
                        style={{ backgroundColor: p.bg }}>
                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: p.accent }} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border-2 border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Custom palette</span>
                      {customColors && (
                        <button type="button" className="text-xs text-muted-foreground underline"
                          onClick={() => setCustomColors(null)}>Reset to preset</button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {([
                        { key: "bg", label: "Background" },
                        { key: "accent", label: "Accent" },
                        { key: "text", label: "Text" },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {label}
                          <input type="color"
                            value={(customColors ?? PRESETS[preset])[key]}
                            onChange={(e) => {
                              const base = customColors ?? PRESETS[preset];
                              setCustomColors({ ...base, [key]: e.target.value });
                            }}
                            className="h-10 w-full rounded-md border border-border bg-transparent cursor-pointer" />
                        </label>
                      ))}
                    </div>
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
                  <Label>Total steps (max 32)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={32}
                    value={totalSteps}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (Number.isNaN(raw)) { setTotalSteps(0); return; }
                      setTotalSteps(Math.min(32, Math.max(0, raw)));
                    }}
                    className="mt-2 w-32"
                  />
                </div>
                <p className="text-sm text-muted-foreground">Tap a step on the preview above to set the benefit shown when the customer reaches it (e.g. "-50%" on step 5, "FREE" on step 10).</p>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center space-y-3">
                  <OrnamentDivider className="w-32 mx-auto opacity-60" />
                  <h3 className="font-display text-xl">Looks good?</h3>
                  <p className="text-sm text-muted-foreground">You can edit anything later from the dashboard.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border-2 border-border p-3">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Customers can only claim active cards.</p>
                  </div>
                  <Switch checked={active} onCheckedChange={setActive} />
                </div>
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
            <Button onClick={save} disabled={saving}>
              <Check className="h-4 w-4" /> {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create card")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
