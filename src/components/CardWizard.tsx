import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { StampCard, STAMP_ICONS } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { ArrowLeft, ArrowRight, Check, Sparkles, Trash2 } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { BackButton } from "@/components/BackButton";
import { CardUsageSection } from "@/components/CardUsageSection";
import { DEFAULT_CARD_TERMS, type CardDraft } from "@/lib/card-draft";
import { generateCardTerms } from "@/lib/card-terms.functions";

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

/** Persisted cards require a selected business; onboarding only edits a draft. */
type Props = {
  templateId?: string;
  businessId: string;
  draft?: never;
  onDraftComplete?: never;
  onCancel?: never;
} | {
  templateId?: never;
  businessId?: never;
  businessName: string;
  draft?: CardDraft;
  onDraftComplete: (draft: CardDraft) => void;
  onCancel: () => void;
};

export function CardWizard(props: Props) {
  const { templateId, businessId: selectedBusinessId, draft, onDraftComplete, onCancel } = props;
  const draftBusinessName = "businessName" in props ? props.businessName : "";
  const draftMode = !!onDraftComplete;
  const isEdit = !!templateId;
  const navigate = useNavigate();
  const generateTerms = useServerFn(generateCardTerms);
  const termsRequest = useRef({ id: 0, pending: false });
  const [generatingTerms, setGeneratingTerms] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(draftBusinessName);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("Loyalty Card");
  const [subtitle, setSubtitle] = useState("");
  const [terms, setTerms] = useState(DEFAULT_CARD_TERMS);
  const [cornerTitle, setCornerTitle] = useState<string | null>(null);
  const [totalSteps, setTotalSteps] = useState(10);
  const [shape, setShape] = useState<CardShape>("rounded");
  const [preset, setPreset] = useState<number>(0);
  const [customColors, setCustomColors] = useState<{ bg: string; accent: string; text: string } | null>(null);
  const [icon, setIcon] = useState<StampIconName | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [gridCols, setGridCols] = useState<number | null>(5);
  const [active, setActive] = useState(true);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    (async () => {
      if (draftMode) {
        setBusinessName(draftBusinessName);
        if (draft) {
          setTitle(draft.title);
          setSubtitle(draft.subtitle ?? "");
          setTerms(draft.terms_and_conditions || DEFAULT_CARD_TERMS);
          setCornerTitle(draft.corner_title);
          setTotalSteps(draft.total_steps);
          setShape(draft.shape);
          setCustomColors({ bg: draft.bg_color, accent: draft.accent_color, text: draft.text_color });
          setIcon(draft.stamp_icon);
          setLogoUrl(draft.logo_url ?? "");
          setRewards(draft.rewards);
          setGridCols(draft.grid_cols);
          setActive(draft.active);
        }
        setLoading(false);
        return;
      }
      if (!selectedBusinessId) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Never resolve "the first business I own" here. The dashboard has
      // already selected the business and this ID must remain authoritative
      // for owners with multiple businesses as well as invited admins.
      const { data: b } = await supabase
        .from("businesses")
        .select("id,name")
        .eq("id", selectedBusinessId)
        .maybeSingle();
      if (!b) { navigate({ to: "/workspace" }); return; }
      setBusinessId((b as { id: string }).id);
      setBusinessName(b.name);

      if (isEdit && templateId) {
        const { data: t } = await supabase.from("card_templates").select("*").eq("id", templateId).maybeSingle();
        if (t) {
          const { data: pending } = await supabase.rpc("get_pending_moderation", {
            _entity_type: "card",
            _entity_id: templateId,
          });
          const proposed = (pending as { proposed_data?: { card?: Record<string, unknown> } } | null)
            ?.proposed_data?.card;
          const tpl = (proposed ?? t) as unknown as {
            title: string; subtitle: string | null;
            corner_title: string | null;
            total_steps: number; shape: CardShape;
            bg_color: string; accent_color: string; text_color: string; stamp_icon: StampIconName;
            logo_url: string | null; rewards: Reward[] | null; active: boolean;
            grid_cols: number | null;
            terms_and_conditions: string;
          };
          setTitle(tpl.title);
          setSubtitle(tpl.subtitle ?? "");
          setTerms(tpl.terms_and_conditions || DEFAULT_CARD_TERMS);
          setCornerTitle(tpl.corner_title);
          setTotalSteps(tpl.total_steps);
          setShape(tpl.shape);
          const pi = matchPreset(tpl.bg_color, tpl.accent_color, tpl.text_color);
          if (pi >= 0) setPreset(pi);
          else setCustomColors({ bg: tpl.bg_color, accent: tpl.accent_color, text: tpl.text_color });
          setIcon(tpl.stamp_icon);
          setLogoUrl(tpl.logo_url ?? "");
          setRewards(tpl.rewards ?? []);
          setGridCols(tpl.grid_cols ?? null);
          setActive(tpl.active);
        }
      }
      setLoading(false);
    })();
  }, [navigate, isEdit, selectedBusinessId, templateId, draftMode, draft, draftBusinessName]);

  useEffect(() => () => {
    // Ignore an in-flight answer after leaving the wizard.
    termsRequest.current.id += 1;
    termsRequest.current.pending = false;
  }, []);

  const generateTermsWithAI = async () => {
    if (termsRequest.current.pending) return;
    termsRequest.current.pending = true;
    const requestId = ++termsRequest.current.id;
    setGeneratingTerms(true);
    try {
      const result = await generateTerms({
        data: {
          businessName,
          title,
          subtitle: subtitle || null,
          totalSteps,
          rewards: rewards.filter((reward) => reward.step >= 1 && reward.step <= totalSteps && reward.label.trim()),
        },
      });
      if (termsRequest.current.id !== requestId) return;
      const generated = result.terms.trim();
      if (generated.length < 10 || generated.length > 20000) {
        throw new Error("The AI returned invalid terms. Please try again.");
      }
      setTerms(generated);
    } catch (error) {
      if (termsRequest.current.id !== requestId) return;
      toast.error("Could not generate terms", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (termsRequest.current.id === requestId) {
        termsRequest.current.pending = false;
        setGeneratingTerms(false);
      }
    }
  };

  const { bg, accent, text } = customColors ?? PRESETS[preset];

  const save = async () => {
    setShowErrors(true);
    if (title.trim().length === 0) { setStep(0); toast.error("Add a card title"); return; }
    if (terms.trim().length < 10) { setStep(3); toast.error("Add terms and conditions for this card"); return; }
    if (!draftMode && !businessId) return;
    setSaving(true);
    const cleanRewards = rewards.filter((r) => r.step >= 1 && r.step <= totalSteps && r.label.trim().length > 0);
    const payload: CardDraft = {
      title, subtitle: subtitle || null,
      corner_title: cornerTitle?.trim() || null,
      total_steps: totalSteps, shape,
      bg_color: bg, accent_color: accent, text_color: text,
      stamp_icon: icon ?? "star", logo_url: logoUrl || null, rewards: cleanRewards, active,
      grid_cols: gridCols,
      terms_and_conditions: terms.trim(),
      ...(draft?.stamp_shape ? { stamp_shape: draft.stamp_shape } : {}),
      ...(draft?.step_size ? { step_size: draft.step_size } : {}),
    };
    if (onDraftComplete) {
      onDraftComplete(payload);
      setSaving(false);
      return;
    }
    const { error } = isEdit && templateId
      ? await supabase.rpc("submit_card_changes", {
          _template_id: templateId,
          _changes: payload,
        })
      : await supabase.from("card_templates").insert({ business_id: businessId!, ...payload });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Card changes submitted for review" : "Card submitted for review");
    navigate({ to: "/business", search: selectedBusinessId ? { businessId: selectedBusinessId } : {} });
  };

  const remove = async () => {
    if (!isEdit || !templateId) return;
    if (!confirm("Delete this card? Customer instances will also be removed.")) return;
    const { error } = await supabase.from("card_templates").delete().eq("id", templateId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    navigate({ to: "/business", search: selectedBusinessId ? { businessId: selectedBusinessId } : {} });
  };

  const stepsLabels = ["Basics", "Style", "Steps & rewards", "Terms", "Review"];
  const face = step >= 2 ? "stamps" : "info";

  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingField, setEditingField] = useState<null | "title" | "subtitle" | "icon" | "cornerTitle">(null);

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

  if (loading) return <ScreenLoader />;

  const goBack = () => {
    // A late answer must not overwrite terms for a subsequently edited card.
    termsRequest.current.id += 1;
    termsRequest.current.pending = false;
    setGeneratingTerms(false);
    if (step > 0) { setShowErrors(false); setStep(step - 1); return; }
    if (onCancel) { onCancel(); return; }
    navigate({ to: "/business", search: selectedBusinessId ? { businessId: selectedBusinessId } : {} });
  };

  return (
    <div className={draftMode ? "py-2" : "min-h-screen px-4 py-6 max-w-2xl mx-auto"}>
      <header className="flex items-center gap-3">
        <BackButton label={step === 0 && !draftMode ? "Back to business dashboard" : "Previous step"} onClick={goBack} />
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Step {step + 1} / {stepsLabels.length}{isEdit ? " · Editing" : ""}</p>
          <h1 className="font-display text-2xl font-semibold">{stepsLabels[step]}</h1>
        </div>
        {isEdit && (
          <Button variant="ghost" size="icon" aria-label="Delete card" className="text-destructive" onClick={remove} title="Delete card" disabled={generatingTerms}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div className="h-full bg-ink" animate={{ width: `${((step + 1) / stepsLabels.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4">
        {step < 2 && (
          <p className="mb-3 text-center text-xs text-muted-foreground">Tap the title, subtitle or icon on the card to edit</p>
        )}
        {step === 2 && (
          totalSteps > 0 ? (
            <p className="mb-3 text-center text-sm font-medium text-ink">Tap on step to set rewards</p>
          ) : (
            <p className="mb-3 text-center text-xs text-muted-foreground">No steps configured. Increase total steps to add rewards.</p>
          )
        )}
        <StampCard title={title || "Card title"} subtitle={subtitle}
          businessName={businessName}
          cornerTitle={cornerTitle}
          totalSteps={totalSteps} stampsCount={0}
          shape={shape} face={face}
          gridCols={gridCols}
          bgColor={bg} accentColor={accent} textColor={text} stampIcon={icon}
          logoUrl={logoUrl || null} rewards={rewards}
          onStepClick={step === 2 ? openStepEditor : undefined}
          activeStep={editingStep ?? undefined}
          onTitleClick={step < 2 ? () => { setEditingStep(null); setEditingField("title"); } : undefined}
          onSubtitleClick={step < 2 ? () => { setEditingStep(null); setEditingField("subtitle"); } : undefined}
          onIconClick={step < 2 ? () => { setEditingStep(null); setEditingField("icon"); } : undefined}
          onCornerTitleClick={step < 2 ? () => { setEditingStep(null); setEditingField("cornerTitle"); } : undefined} />

        {editingField === "title" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Title</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus maxLength={200} aria-invalid={showErrors && !title.trim()} className={showErrors && !title.trim() ? "border-destructive ring-1 ring-destructive" : undefined} value={title} onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }} />
              <Button size="sm" onClick={() => setEditingField(null)}><Check className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        {editingField === "cornerTitle" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Corner title (top-left)</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={cornerTitle ?? ""} onChange={(e) => setCornerTitle(e.target.value)}
                placeholder={businessName || "Business name"}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }} />
              <Button size="sm" variant="ghost" onClick={() => setCornerTitle(null)} title="Reset to business name">Reset</Button>
              <Button size="sm" onClick={() => setEditingField(null)}><Check className="h-4 w-4" /></Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Leave empty or reset to use the business name.</p>
          </div>
        )}
        {editingField === "subtitle" && (
          <div className="mt-4 rounded-xl border-2 border-ink/10 bg-secondary/50 p-3">
            <Label className="text-xs">Subtitle</Label>
            <div className="mt-2 flex gap-2">
              <Input autoFocus value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Each 8th cup of coffee is free"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }} />
              <Button size="sm" onClick={() => setEditingField(null)}><Check className="h-4 w-4" /></Button>
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
                  <img src={logoUrl} alt="Business logo preview" className="h-8 w-8 rounded-full ring-1 ring-black/10 bg-white p-0.5" />
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
      </div>

      <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card paper-grain p-6">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="card-title">Title *</Label>
                  <Input id="card-title" required maxLength={200} aria-invalid={showErrors && !title.trim()} className={showErrors && !title.trim() ? "border-destructive ring-1 ring-destructive" : undefined} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="5 klipp -50%" />
                  {showErrors && !title.trim() && <p className="mt-1 text-sm text-destructive" role="alert">Add a card title</p>}
                </div>
                <div>
                  <Label>Subtitle (optional)</Label>
                  <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Each 8th cup of coffee is free" />
                </div>
                <div>
                  <Label>Logo (SVG, optional)</Label>
                  <Input type="file" accept="image/svg+xml,.svg"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleLogoUpload(f); }} />
                  {logoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={logoUrl} alt="Business logo preview" className="h-10 w-10 rounded-full ring-1 ring-black/10 bg-white p-1" />
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
                  <Label htmlFor="card-total-steps">Total steps (max 32)</Label>
                  <Input
                    id="card-total-steps"
                    type="number"
                    min={0}
                    max={32}
                    value={totalSteps || ""}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      setTotalSteps(Number.isFinite(raw) ? Math.min(32, Math.max(0, Math.trunc(raw))) : 0);
                      setEditingStep(null);
                    }}
                    className="mt-2 w-32"
                  />
                </div>
                <div>
                  <Label>Grid layout</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick columns per row. Rows are calculated automatically (max 4 rows).
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setGridCols(null)}
                      className={`rounded-lg border-2 px-3 py-2 text-xs ${gridCols == null ? "border-ink bg-secondary" : "border-border"}`}>
                      Auto
                    </button>
                    {totalSteps > 0 && Array.from({ length: 8 - Math.min(7, Math.ceil(totalSteps / 4) - 1) }, (_, i) => {
                      const c = Math.ceil(totalSteps / 4) + i;
                      const rows = Math.ceil(totalSteps / c);
                      return (
                        <button key={c} type="button" onClick={() => setGridCols(c)}
                          className={`rounded-lg border-2 px-3 py-2 text-xs ${gridCols === c ? "border-ink bg-secondary" : "border-border"}`}>
                          {c} × {rows}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Tap a step on the preview above to set the benefit shown when the customer reaches it (e.g. "-50%" on step 5, "FREE" on step 10).</p>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="card-terms">Terms &amp; conditions</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Customers must read and accept these terms before adding the card to any wallet.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full gap-2 sm:w-auto"
                    onClick={generateTermsWithAI}
                    disabled={generatingTerms}
                    aria-busy={generatingTerms}
                    aria-controls="card-terms"
                  >
                    {generatingTerms ? <Spinner size={16} label={null} /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                    <span aria-live="polite">{generatingTerms ? "Generating…" : "Generate with AI"}</span>
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    AI generates an English draft and replaces the text below. Review it before saving.
                  </p>
                  <Textarea
                    id="card-terms"
                    required
                    readOnly={generatingTerms}
                    aria-busy={generatingTerms}
                    aria-invalid={showErrors && terms.trim().length < 10}
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                    placeholder="Explain how stamps are earned, when rewards can be used, expiry rules, exclusions, and any other conditions."
                    rows={10}
                    maxLength={20000}
                    className={`mt-3 ${showErrors && terms.trim().length < 10 ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                  {showErrors && terms.trim().length < 10 && <p className="text-sm text-destructive" role="alert">Add terms and conditions for this card</p>}
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">{terms.length}/20,000</p>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <div className="text-center space-y-3">
                  <OrnamentDivider className="w-32 mx-auto opacity-60" />
                  <h3 className="font-display text-xl">Looks good?</h3>
                  <p className="text-sm text-muted-foreground">{draftMode ? "This card will be submitted for review with your business." : "You can edit anything later from the dashboard."}</p>
                </div>
                <CardUsageSection totalSteps={totalSteps} rewards={rewards} />
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
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < stepsLabels.length - 1 ? (
            <Button disabled={generatingTerms} onClick={() => {
              setShowErrors(true);
              if (step === 0 && title.trim().length === 0) { toast.error("Add a card title"); return; }
              if (step === 3 && terms.trim().length < 10) { toast.error("Add terms and conditions for this card"); return; }
              setShowErrors(false);
              setStep(step + 1);
            }}>Next <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} disabled={saving}>
              <Check className="h-4 w-4" /> {draftMode ? "Save card draft" : saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create card")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
