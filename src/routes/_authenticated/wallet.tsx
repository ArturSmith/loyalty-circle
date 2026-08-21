import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CreditCard, Gift, RotateCcw, ScanLine, Snowflake, Sparkles, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useServerFn } from "@tanstack/react-start";
import { getWalletCards, type WalletInstance } from "@/utils/cards.functions";
import { invalidateUnusedVoucherCount } from "@/hooks/useUnusedVoucherCount";
import { useProfile } from "@/hooks/useProfile";
import { initialsFrom } from "@/lib/avatar";
import { BusinessInfoPanel } from "@/components/BusinessInfoPanel";
import { DiscoverStrip } from "@/components/DiscoverStrip";
import { BottomNav } from "@/components/BottomNav";


type Instance = WalletInstance;

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "My Wallet — ClubCarder" }] }),
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

const BUSINESS_CTA_KEY = "cc_business_cta_hidden_until";
const BUSINESS_CTA_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// Survives tab switches so returning to Wallet renders the previous cards
// immediately while a fresh fetch runs in the background.
let cachedWallet: { instances: Instance[]; frozenBusinessIds: string[] } | null = null;

function Wallet() {
  const [instances, setInstances] = useState<Instance[]>(() => cachedWallet?.instances ?? []);
  const [frozenBusinessIds, setFrozenBusinessIds] = useState<Set<string>>(
    () => new Set(cachedWallet?.frozenBusinessIds ?? []),
  );
  const [loading, setLoading] = useState(() => cachedWallet === null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [faceFlipped, setFaceFlipped] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [businessCtaHidden, setBusinessCtaHidden] = useState(true);

  const fetchWallet = useServerFn(getWalletCards);
  const { profile, loading: profileLoading } = useProfile();

  const displayInstances = useMemo(() => {
    if (!frontId) return instances;
    const idx = instances.findIndex((i) => i.id === frontId);
    if (idx === -1) return instances;
    return [...instances.slice(0, idx), ...instances.slice(idx + 1), instances[idx]];
  }, [instances, frontId]);

  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(BUSINESS_CTA_KEY) ?? 0);
      setBusinessCtaHidden(Number.isFinite(until) && until > Date.now());
    } catch {
      setBusinessCtaHidden(false);
    }
  }, []);

  const dismissBusinessCta = useCallback(() => {
    setBusinessCtaHidden(true);
    try {
      window.localStorage.setItem(BUSINESS_CTA_KEY, String(Date.now() + BUSINESS_CTA_SNOOZE_MS));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const { instances: next, frozenBusinessIds: nextFrozenBusinessIds } = await fetchWallet({ data: { environment: getPaddleEnvironment() } });
      cachedWallet = { instances: next, frozenBusinessIds: nextFrozenBusinessIds };
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
            // A reward step just unlocked, which means a voucher was issued —
            // move the nav badge without waiting on realtime.
            if (unlocked) invalidateUnusedVoucherCount();
            break;
          }
        }
        return next;
      });
      setFrozenBusinessIds(new Set(nextFrozenBusinessIds));
    } catch (error) {
      console.error("Error loading wallet cards:", error);
      if (cachedWallet === null) {
        setInstances([]);
        setFrozenBusinessIds(new Set());
        const errorMessage = error instanceof Error ? error.message : "Please try again.";
        toast.error("Couldn't load your cards", { description: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWallet]);

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

  // Realtime: refresh when stamps come in for any card the user owns.
  // Realtime can silently fail (network, socket drop), so we also poll as a fallback.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (cancelled || !userId) return;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      channel = supabase.channel(`wallet-stamps:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "card_instances", filter: `customer_id=eq.${userId}` },
          () => load(),
        )
        .subscribe();
    })();

    const poll = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      load();
    }, 4000);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
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


  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your wallet…</div>;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden pb-24">
      <header className="relative flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/profile" aria-label="Open your profile">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full glass-panel border border-border text-xs font-bold">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Your profile picture" className="h-full w-full object-cover" />
              ) : (
                initialsFrom(profile?.displayName, profile?.email)
              )}
            </span>
          </Link>
          <p className="text-sm text-muted-foreground truncate">
            Hello{profile?.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""} 👋
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/scan">
            <Button variant="ghost" size="icon" aria-label="Scan QR code" title="Scan QR" className="rounded-full glass-panel">
              <ScanLine className="h-5 w-5" />
            </Button>
          </Link>
        </div>

      </header>

      {!profileLoading && !profile?.hasBusiness && !businessCtaHidden && (
        <div className="relative px-5 pt-2 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mx-auto max-w-md rounded-2xl glass-panel border border-border p-4 text-left"
          >
            <button
              type="button"
              onClick={dismissBusinessCta}
              aria-label="Hide this suggestion for a week"
              className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h2 className="font-display text-lg font-bold">Own a business?</h2>
                <p className="mt-0.5 text-sm text-muted-foreground leading-snug">
                  Start your business profile and create your own customized loyalty card.
                </p>
                <Link to="/business" className="mt-3 block">
                  <Button size="sm" className="gap-2">
                    <Sparkles className="h-4 w-4" /> Start my business profile
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <DiscoverStrip />

      {instances.length > 0 && (
        <section className="relative px-5 pt-6" aria-label="My cards">
          <div className="mx-auto max-w-md">
            <h1 className="flex items-center gap-2 font-display text-lg font-bold">
              <CreditCard className="h-4 w-4" /> My cards
            </h1>
          </div>
        </section>
      )}

      {instances.length === 0 ? (
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="relative h-40 w-40 rounded-3xl border border-border bg-secondary flex items-center justify-center"
          >
            <div className="absolute inset-3 rounded-2xl bg-card border border-border flex items-center justify-center">
              <ScanLine className="h-14 w-14 text-primary" />
            </div>
            <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
          </motion.div>

          <h2 className="mt-8 font-display text-3xl font-extrabold">No cards yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Scan a business's QR to add your first loyalty card.</p>
        </div>
      ) : (
        <>
        <div
          className="relative mt-4 flex-1 overflow-y-auto px-4 pb-6"
          onClick={() => setExpandedId(null)}
        >
          {(() => {
            const CARD_H = 220;
            const PEEK = 56;
            const TIGHT = 34;
            const GAP = 14;
            const expandedIndex = expandedId ? displayInstances.findIndex((x) => x.id === expandedId) : -1;
            const totalHeight =
              expandedIndex >= 0
                ? expandedIndex * TIGHT + CARD_H + GAP + Math.max(0, displayInstances.length - expandedIndex - 1) * (TIGHT + 8) + 40
                : (displayInstances.length - 1) * PEEK + CARD_H + 40;

            return (
              <div className="relative mx-auto max-w-md" style={{ height: totalHeight }}>
                {displayInstances.map((inst, i) => {
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
                  return (
                    <motion.div
                      key={inst.id}
                      className="absolute inset-x-0"
                      initial={false}
                      animate={{ y: top, scale: isExpanded ? 1 : 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 30 }}
                      style={{ zIndex: i + 1 }}
                    >
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.35}
                        dragSnapToOrigin
                        onDragEnd={(_, info) => {
                          if (Math.abs(info.offset.x) > 60) {
                            setFaceFlipped((prev) => {
                              const next = new Set(prev);
                              if (next.has(inst.id)) next.delete(inst.id);
                              else next.add(inst.id);
                              return next;
                            });
                          }
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isExpanded) {
                              setFlippedId(inst.id);
                            } else {
                              setFrontId(inst.id);
                              setExpandedId(inst.id);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            if (isExpanded) {
                              setFlippedId(inst.id);
                            } else {
                              setFrontId(inst.id);
                              setExpandedId(inst.id);
                            }
                          }}
                          className="relative block w-full text-left focus:outline-none drop-shadow-2xl"
                          aria-label={isExpanded ? `Show QR for ${inst.template.title}` : `Open ${inst.template.title}`}
                        >
                          <div className="relative">
                            <div className={isFrozen ? "opacity-75" : undefined}>
                              <StampCard
                                title={inst.template.title}
                                subtitle={inst.template.subtitle}
                                cornerTitle={inst.template.corner_title}
                                description={inst.template.description}
                                totalSteps={inst.template.total_steps}
                                stampsCount={inst.stamps_count}
                                shape={inst.template.shape}
                                gridCols={inst.template.grid_cols}
                                bgColor={inst.template.bg_color}
                                accentColor={inst.template.accent_color}
                                textColor={inst.template.text_color}
                                stampIcon={inst.template.stamp_icon}
                                logoUrl={inst.template.logo_url}
                                rewards={inst.template.rewards}
                                businessName={inst.template.business.name}
                                lastStamp={inst.stamps_count}
                                face={faceFlipped.has(inst.id) ? "stamps" : "info"}
                                showFlipButton
                                onFlip={() => {
                                  setFaceFlipped((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(inst.id)) next.delete(inst.id);
                                    else next.add(inst.id);
                                    return next;
                                  });
                                }}
                              />
                            </div>
                            {isFrozen && (
                              <div className="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg ring-1 ring-border backdrop-blur">
                                <Snowflake className="h-3 w-3" /> Frozen
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>

                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {expandedId ? "Tap again for QR · swipe to flip" : "Tap a card to bring it forward · swipe to flip"}
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
            const { error } = await supabase.rpc("renew_card", {
              _card_instance_id: inst.id,
            });
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
            
            // Verify user is authenticated before attempting delete
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              toast.error("Not authenticated", { description: "Please sign in again to remove cards." });
              return;
            }
            
            // First attempt the delete
            const { error: deleteError } = await supabase.from("card_instances").delete().eq("id", inst.id).eq("customer_id", user.id);
            if (deleteError) {
              console.error("Delete error:", deleteError);
              toast.error("Couldn't remove card", { description: deleteError.message });
              return;
            }
            
            // Delete was successful, now reload
            toast.success("Card removed from your wallet");
            setFlippedId(null);
            setExpandedId(null);
            
            try {
              await load();
            } catch (loadError) {
              console.error("Load error after delete:", loadError);
              toast.error("Card removed but couldn't refresh wallet", { description: loadError instanceof Error ? loadError.message : "Please refresh the page." });
            }
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
              {inst && <BusinessInfoPanel business={inst.template.business} />}

              {isCompleted && (
                <Button
                  onClick={renew}
                  className="mt-5 w-full h-12 gap-2 rounded-2xl bg-primary text-primary-foreground border-0 hover:bg-primary/90"
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
      <BottomNav />
    </div>
  );
}
