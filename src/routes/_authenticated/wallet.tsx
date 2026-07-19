import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName, StampShape } from "@/components/StampCard";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Gift, LogOut, Menu, RotateCcw, ScanLine, Snowflake, Sparkles, Store, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useServerFn } from "@tanstack/react-start";
import { getFrozenBusinessIds } from "@/utils/frozen-businesses.functions";

type Instance = {
  id: string; stamps_count: number; completed_at: string | null; created_at: string; order_index: number | null;
  template: {
    id: string; title: string; subtitle: string | null; total_steps: number; shape: CardShape; stamp_shape?: StampShape;
    bg_color: string; accent_color: string; text_color: string; stamp_icon: StampIconName;
    logo_url: string | null; rewards: Reward[];
    business: { id: string; name: string };
  };
};

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "My Wallet — Stempel" }] }),
  component: Wallet,
});

type Celebration = {
  instanceId: string;
  title: string;
  businessName: string;
  stampsCount: number;
  totalSteps: number;
  stepsToNext: number | null;
  nextReward: Reward | null;
  unlockedReward: Reward | null;
  completed: boolean;
  accentColor: string;
};

function Wallet() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [frozenBusinessIds, setFrozenBusinessIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const fetchFrozen = useServerFn(getFrozenBusinessIds);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setInstances([]); setLoading(false); return; }
    const { data } = await supabase
      .from("card_instances")
      .select(`id, stamps_count, completed_at, created_at, order_index,
        template:card_templates!inner(id, title, subtitle, total_steps, shape, stamp_shape, bg_color, accent_color, text_color, stamp_icon, logo_url, rewards,
          business:businesses!inner(id, name))`)
      .eq("customer_id", u.user.id)
      .order("order_index", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    const next = (data as unknown as Instance[]) ?? [];
    // Diff against previous state to celebrate any stamp increment for the current user
    setInstances((prev) => {
      const prevMap = new Map(prev.map((p) => [p.id, p.stamps_count]));
      for (const inst of next) {
        const before = prevMap.get(inst.id);
        if (before !== undefined && inst.stamps_count > before) {
          const rewards = (inst.template.rewards ?? []) as Reward[];
          const unlocked = rewards.find((r) => r.step === inst.stamps_count) ?? null;
          const upcoming = rewards
            .filter((r) => r.step > inst.stamps_count)
            .sort((a, b) => a.step - b.step)[0] ?? null;
          const stepsToNext = upcoming
            ? upcoming.step - inst.stamps_count
            : inst.stamps_count < inst.template.total_steps
            ? inst.template.total_steps - inst.stamps_count
            : null;
          setCelebration({
            instanceId: inst.id,
            title: inst.template.title,
            businessName: inst.template.business.name,
            stampsCount: inst.stamps_count,
            totalSteps: inst.template.total_steps,
            stepsToNext,
            nextReward: upcoming,
            unlockedReward: unlocked,
            completed: inst.stamps_count >= inst.template.total_steps,
            accentColor: inst.template.accent_color,
          });
          break;
        }
      }
      return next;
    });
    // Check which businesses are frozen (subscription lapsed)
    const bizIds = Array.from(new Set(next.map((i) => i.template.business.id)));
    if (bizIds.length > 0) {
      const frozen = await fetchFrozen({ data: { ids: bizIds } });
      setFrozenBusinessIds(new Set(frozen));
    } else {
      setFrozenBusinessIds(new Set());
    }
    setLoading(false);
  }, [fetchFrozen]);

  useEffect(() => { load(); }, [load]);

  // If arriving from a business page with a card to open, expand + flip it
  useEffect(() => {
    if (loading || instances.length === 0) return;
    let target: string | null = null;
    try { target = sessionStorage.getItem("open_card_id"); } catch {}
    if (!target) return;
    try { sessionStorage.removeItem("open_card_id"); } catch {}
    if (instances.find((i) => i.id === target)) {
      setExpandedId(target);
      setFlippedId(target);
    }
  }, [loading, instances]);

  // Realtime: refresh when stamps come in for any card the user owns
  useEffect(() => {
    const channel = supabase.channel("wallet-stamps")
      .on("postgres_changes", { event: "*", schema: "public", table: "card_instances" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Auto-dismiss celebration
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 5000);
    return () => clearTimeout(t);
  }, [celebration]);


  // Keep expanded card valid when instances change
  useEffect(() => {
    if (expandedId && !instances.find((i) => i.id === expandedId)) setExpandedId(null);
  }, [instances, expandedId]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your wallet…</div>;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 h-64 w-64 rounded-full bg-[oklch(0.82_0.16_300/0.4)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-[oklch(0.86_0.14_195/0.4)] blur-3xl" />

      <header className="relative flex items-center justify-between px-5 py-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          My <span className="text-iridescent italic">cards</span>
        </h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" title="Menu" className="rounded-full glass-panel"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-2">
              <Link to="/profile" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <User className="h-4 w-4" /> Profile
                </Button>
              </Link>
              <Link to="/business" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Store className="h-4 w-4" /> Business dashboard
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {instances.length === 0 ? (
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: -4 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative h-40 w-40 rounded-[2rem] sticker-shadow border border-white/70 flex items-center justify-center"
            style={{ backgroundImage: "var(--gradient-iris)" }}
          >
            <div className="absolute inset-3 rounded-[1.5rem] bg-white/40 backdrop-blur-md flex items-center justify-center">
              <ScanLine className="h-14 w-14 text-foreground/80" />
            </div>
            <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-white text-foreground sticker-shadow flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </motion.div>
          <h2 className="mt-8 font-display text-3xl font-extrabold">No cards yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Scan a business's QR to add your first loyalty card.</p>
          <Link to="/scan" className="mt-8 w-full max-w-xs">
            <Button size="lg" className="w-full h-14 gap-2 text-base rounded-2xl bg-[image:var(--gradient-primary)] text-white sticker-shadow border-0 hover:opacity-95">
              <ScanLine className="h-5 w-5" /> Scan QR
            </Button>
          </Link>
        </div>
      ) : (
        <>
        <div
          className="relative flex-1 overflow-y-auto px-4 pb-10"
          onClick={() => setExpandedId(null)}
        >
          {(() => {
            const CARD_H = 220;
            const PEEK = 56;
            const TIGHT = 34;
            const GAP = 14;
            const expandedIndex = expandedId ? instances.findIndex((x) => x.id === expandedId) : -1;
            const totalHeight =
              expandedIndex >= 0
                ? expandedIndex * TIGHT + CARD_H + GAP + Math.max(0, instances.length - expandedIndex - 1) * (TIGHT + 8) + 40
                : (instances.length - 1) * PEEK + CARD_H + 40;

            return (
              <div className="relative mx-auto max-w-md" style={{ height: totalHeight }}>
                {instances.map((inst, i) => {
                  const isExpanded = i === expandedIndex;
                  let top: number;
                  if (expandedIndex < 0) {
                    top = i * PEEK;
                  } else if (i < expandedIndex) {
                    top = i * TIGHT;
                  } else if (i === expandedIndex) {
                    top = expandedIndex * TIGHT + GAP;
                  } else {
                    top = expandedIndex * TIGHT + GAP + CARD_H + GAP + (i - expandedIndex - 1) * (TIGHT + 8);
                  }
                  const isFrozen = frozenBusinessIds.has(inst.template.business.id);
                  // Stable z-index: expanded card always on top, others keep their stack order
                  const zIndex = isExpanded ? 100 : instances.length - i;
                  return (
                    <motion.div
                      key={inst.id}
                      layout
                      className="absolute inset-x-0"
                      initial={false}
                      animate={{ y: top, scale: isExpanded ? 1.02 : 1 }}
                      transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.8 }}
                      style={{ zIndex }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isExpanded) {
                            setFlippedId(inst.id);
                          } else {
                            setExpandedId(inst.id);
                          }
                        }}
                        className="relative block w-full text-left focus:outline-none drop-shadow-2xl"
                        aria-label={isExpanded ? `Show QR for ${inst.template.title}` : `Open ${inst.template.title}`}
                      >
                        <div className={isFrozen ? "relative" : undefined}>
                          <StampCard
                            title={inst.template.title}
                            subtitle={inst.template.subtitle}
                            totalSteps={inst.template.total_steps}
                            stampsCount={inst.stamps_count}
                            shape={inst.template.shape}
                            stampShape={inst.template.stamp_shape ?? "circle"}
                            bgColor={inst.template.bg_color}
                            accentColor={inst.template.accent_color}
                            textColor={inst.template.text_color}
                            stampIcon={inst.template.stamp_icon}
                            logoUrl={inst.template.logo_url}
                            rewards={inst.template.rewards}
                            businessName={inst.template.business.name}
                            lastStamp={inst.stamps_count}
                          />
                          {isFrozen && (
                            <div className="pointer-events-none absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-sky-500/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg ring-1 ring-white/40 backdrop-blur">
                              <Snowflake className="h-3 w-3" /> Frozen
                            </div>
                          )}
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {expandedId ? "Tap the card again to show your QR" : "Tap a card to bring it forward"}
          </p>
        </div>

        </>
      )}

      <AnimatePresence>
        {flippedId && (() => {
          const inst = instances.find((x) => x.id === flippedId);
          const isCompleted = !!inst?.completed_at || (inst ? inst.stamps_count >= inst.template.total_steps : false);
          const isFrozen = !!inst && frozenBusinessIds.has(inst.template.business.id);
          const renew = async () => {
            if (!inst) return;
            const { error } = await supabase
              .from("card_instances")
              .update({ stamps_count: 0, completed_at: null })
              .eq("id", inst.id);
            if (error) {
              toast.error("Couldn't renew card", { description: error.message });
              return;
            }
            toast.success("Card renewed — start collecting again!");
            setFlippedId(null);
            load();
          };
          const remove = async () => {
            if (!inst) return;
            if (!window.confirm(`Remove "${inst.template.title}" from your wallet? This cannot be undone.`)) return;
            const { error } = await supabase.from("card_instances").delete().eq("id", inst.id);
            if (error) {
              toast.error("Couldn't remove card", { description: error.message });
              return;
            }
            toast.success("Card removed from your wallet");
            setFlippedId(null);
            setExpandedId(null);
            load();
          };
          return (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setFlippedId(null)}
          >
            <motion.div
              initial={{ scale: 0.85, rotateY: 90 }} animate={{ scale: 1, rotateY: 0 }} exit={{ scale: 0.85, rotateY: -90 }}
              transition={{ type: "spring", damping: 22, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center"
            >
              <button onClick={() => setFlippedId(null)} className="absolute top-3 right-3 p-2 opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
              <OrnamentDivider className="w-40 mx-auto opacity-70" />
              {isCompleted ? (
                <>
                  <div className="mt-3 inline-flex items-center gap-2 text-gold">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-widest">Card complete</span>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-2xl mt-2">Reward unlocked</h3>
                  <p className="text-xs text-muted-foreground">Show this code to redeem, then renew to start again</p>
                </>
              ) : (
                <>
                  <h3 className="font-display text-2xl mt-3">Show to stamp</h3>
                  <p className="text-xs text-muted-foreground">Let the business scan this code</p>
                </>
              )}
              {isFrozen && (
                <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left text-xs text-sky-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Snowflake className="h-3.5 w-3.5" /> Card frozen
                  </div>
                  <p className="mt-1 text-sky-800">
                    {isCompleted
                      ? "This business's subscription is inactive, but you can still redeem your completed reward."
                      : "This business's subscription is inactive, so new stamps are paused until they resume."}
                  </p>
                </div>
              )}
              <div className="mt-6 flex justify-center">
                <QrDisplay value={`stempel:card:${flippedId}`} size={260} />
              </div>
              <OrnamentDivider className="w-40 mx-auto mt-6 opacity-70" />
              {isCompleted && (
                <Button
                  onClick={renew}
                  className="mt-5 w-full h-12 gap-2 rounded-2xl bg-[image:var(--gradient-primary)] text-white sticker-shadow border-0 hover:opacity-95"
                >
                  <RotateCcw className="h-4 w-4" /> Renew card
                </Button>
              )}
              <Button
                onClick={remove}
                variant="ghost"
                className="mt-3 w-full h-11 gap-2 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Remove from wallet
              </Button>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>


      <AnimatePresence>
        {celebration && (
          <motion.div
            key={`celebrate-${celebration.instanceId}-${celebration.stampsCount}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-ink/85 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => { setCelebration(null); setFlippedId(null); }}
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos((i / 14) * Math.PI * 2) * 160,
                  y: Math.sin((i / 14) * Math.PI * 2) * 160,
                  scale: [0, 1, 0.6],
                  rotate: i * 30,
                }}
                transition={{ duration: 1.2, delay: 0.1 + i * 0.02, ease: "easeOut" }}
                className="pointer-events-none absolute h-2 w-2 rounded-full"
                style={{ background: celebration.accentColor }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 16, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center"
            >
              <button
                onClick={() => { setCelebration(null); setFlippedId(null); }}
                className="absolute top-3 right-3 p-2 opacity-60 hover:opacity-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <OrnamentDivider className="w-40 mx-auto opacity-70" />

              {celebration.completed ? (
                <>
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                    className="mt-4 mx-auto h-24 w-24 rounded-full bg-gold text-ink flex items-center justify-center"
                  >
                    <Sparkles className="h-10 w-10" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Card complete!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{celebration.businessName} · {celebration.title}</p>
                  <div className="mt-4 rounded-lg bg-gold/20 text-ink px-4 py-2 text-sm font-semibold">
                    {celebration.unlockedReward?.label
                      ? `Reward unlocked: ${celebration.unlockedReward.label}`
                      : "Reward unlocked — enjoy!"}
                  </div>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 3, rotate: -18, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="mt-4 mx-auto h-24 w-24 rounded-full bg-ink text-paper flex items-center justify-center stamp-emboss"
                  >
                    <Check className="h-10 w-10" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Stamp added!</h2>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{celebration.businessName}</p>

                  <div className="mt-5 flex items-center justify-center gap-1.5">
                    {Array.from({ length: celebration.totalSteps }).map((_, i) => (
                      <motion.span
                        key={i}
                        initial={{ scale: 0.6, opacity: 0.3 }}
                        animate={{
                          scale: i === celebration.stampsCount - 1 ? [1.4, 1] : 1,
                          opacity: i < celebration.stampsCount ? 1 : 0.25,
                        }}
                        transition={{ delay: i === celebration.stampsCount - 1 ? 0.25 : 0, type: "spring", damping: 12 }}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: i < celebration.stampsCount ? celebration.accentColor : "currentColor" }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {celebration.stampsCount} of {celebration.totalSteps} stamps
                  </p>

                  {celebration.unlockedReward && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4, type: "spring", damping: 14 }}
                      className="mt-4 rounded-lg bg-gold/25 text-ink px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <Gift className="h-4 w-4" /> Reward unlocked: {celebration.unlockedReward.label}
                    </motion.div>
                  )}

                  {celebration.stepsToNext !== null && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm">
                      <Gift className="h-4 w-4 opacity-70" />
                      <span>
                        <strong>{celebration.stepsToNext}</strong>{" "}
                        {celebration.stepsToNext === 1 ? "stamp" : "stamps"} to{" "}
                        {celebration.nextReward ? (
                          <>next reward: <em>{celebration.nextReward.label}</em></>
                        ) : (
                          "complete the card"
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}

              <OrnamentDivider className="w-40 mx-auto opacity-70 mt-6" />
              <Button
                className="mt-6 w-full h-11"
                onClick={() => { setCelebration(null); setFlippedId(null); }}
              >
                Nice!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
