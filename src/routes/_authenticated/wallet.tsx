import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ArrowUpDown, Check, ChevronRight, CreditCard, Gift, GripVertical, ScanLine, Snowflake, Sparkles, Store, UserRoundPen, X } from "lucide-react";
import { toast } from "sonner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useServerFn } from "@tanstack/react-start";
import { getWalletCards, saveWalletCardOrder, type WalletInstance } from "@/utils/cards.functions";
import { invalidateUnusedVoucherCount } from "@/hooks/useUnusedVoucherCount";
import { useProfile } from "@/hooks/useProfile";
import { initialsFrom } from "@/lib/avatar";
import { DiscoverStrip } from "@/components/DiscoverStrip";
import { TabTransition } from "@/components/TabTransition";
import { ScreenLoader } from "@/components/Spinner";
import { getTabCache, setTabCache } from "@/lib/tabCache";
import { CustomerQrCard } from "@/components/CustomerQrCard";
import { NotificationButton } from "@/components/NotificationButton";
import { SpacesButton } from "@/components/business/SpacesButton";


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
type WalletCache = { instances: Instance[]; frozenBusinessIds: string[] };
const WALLET_CACHE_KEY = "wallet";

function Wallet() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>(() => getTabCache<WalletCache>(WALLET_CACHE_KEY)?.instances ?? []);
  const [frozenBusinessIds, setFrozenBusinessIds] = useState<Set<string>>(
    () => new Set(getTabCache<WalletCache>(WALLET_CACHE_KEY)?.frozenBusinessIds ?? []),
  );
  const [loading, setLoading] = useState(() => getTabCache<WalletCache>(WALLET_CACHE_KEY) === null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [faceFlipped, setFaceFlipped] = useState<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [businessCtaHidden, setBusinessCtaHidden] = useState(true);
  const [arranging, setArranging] = useState(false);
  const [arrangeOriginalIds, setArrangeOriginalIds] = useState<string[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const arrangingRef = useRef(false);
  const autoRefreshingRef = useRef<Set<string>>(new Set());
  const cardStackScrollRef = useRef<HTMLDivElement>(null);

  const fetchWallet = useServerFn(getWalletCards);
  const saveCardOrder = useServerFn(saveWalletCardOrder);
  const { profile, loading: profileLoading } = useProfile();
  const missingProfileFields = useMemo(() => {
    if (!profile) return [];
    return [
      !profile.displayName?.trim() ? "Full name" : null,
      !profile.dateOfBirth?.trim() ? "Date of birth" : null,
      !profile.email?.trim() ? "Email" : null,
    ].filter((field): field is string => field !== null);
  }, [profile]);

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
    if (arrangingRef.current) return;
    try {
      const { instances: next, frozenBusinessIds: nextFrozenBusinessIds } = await fetchWallet({ data: { environment: getPaddleEnvironment() } });
      setTabCache<WalletCache>(WALLET_CACHE_KEY, { instances: next, frozenBusinessIds: nextFrozenBusinessIds });
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

      // Completing a card issues its reward as a separate voucher. Once that
      // durable reward exists, reset the stamp card automatically so the
      // customer can start collecting the next round without a manual action.
      const completed = next.filter(
        (instance) =>
          (instance.completed_at !== null ||
            instance.stamps_count >= instance.template.total_steps) &&
          !autoRefreshingRef.current.has(instance.id),
      );
      if (completed.length > 0) {
        completed.forEach((instance) => autoRefreshingRef.current.add(instance.id));
        const results = await Promise.all(
          completed.map(async (instance) => {
            const { error } = await supabase.rpc("renew_card", {
              _card_instance_id: instance.id,
            });
            return { id: instance.id, error };
          }),
        );
        results.forEach(({ id }) => autoRefreshingRef.current.delete(id));

        const refreshedIds = new Set(
          results.filter((result) => !result.error).map((result) => result.id),
        );
        const failed = results.find((result) => result.error)?.error;
        if (failed) console.error("Couldn't auto-refresh a completed card:", failed);

        if (refreshedIds.size > 0) {
          setInstances((current) => {
            const refreshed = current.map((instance) =>
              refreshedIds.has(instance.id)
                ? { ...instance, stamps_count: 0, completed_at: null }
                : instance,
            );
            setTabCache<WalletCache>(WALLET_CACHE_KEY, {
              instances: refreshed,
              frozenBusinessIds: nextFrozenBusinessIds,
            });
            return refreshed;
          });
        }
      }
    } catch (error) {
      console.error("Error loading wallet cards:", error);
      if (getTabCache<WalletCache>(WALLET_CACHE_KEY) === null) {
        setInstances([]);
        setFrozenBusinessIds(new Set());
        const errorMessage = error instanceof Error ? error.message : "Please try again.";
        toast.error("Couldn't load your cards", { description: errorMessage });
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWallet]);

  const openArrangeCards = () => {
    setFrontId(null);
    setExpandedId(null);
    setArrangeOriginalIds(instances.map((instance) => instance.id));
    arrangingRef.current = true;
    setArranging(true);
  };

  const cancelArrangeCards = () => {
    const originalPosition = new Map(arrangeOriginalIds.map((id, index) => [id, index]));
    setInstances((current) =>
      [...current].sort((a, b) => {
        const aPosition = originalPosition.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bPosition = originalPosition.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aPosition - bPosition;
      }),
    );
    arrangingRef.current = false;
    setArranging(false);
  };

  const finishArrangeCards = async () => {
    setSavingOrder(true);
    try {
      await saveCardOrder({ data: { instanceIds: instances.map((instance) => instance.id) } });
      const orderedInstances = instances.map((instance, index) => ({ ...instance, order_index: index }));
      setInstances(orderedInstances);
      setTabCache<WalletCache>(WALLET_CACHE_KEY, {
        instances: orderedInstances,
        frozenBusinessIds: [...frozenBusinessIds],
      });
      arrangingRef.current = false;
      setArranging(false);
      toast.success("Card order saved");
    } catch (error) {
      toast.error("Couldn't save card order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSavingOrder(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  // If arriving from a business page with a card to open, bring it to the
  // front of the stack and show its stamps side without opening a dialog.
  useEffect(() => {
    if (loading || instances.length === 0) return;
    let target: string | null = null;
    try { target = sessionStorage.getItem("open_card_id"); } catch {
      // Session storage may be unavailable in a restricted browser context.
    }
    if (!target) return;
    try { sessionStorage.removeItem("open_card_id"); } catch {
      // The card can still be opened normally if cleanup is unavailable.
    }
    if (instances.find((i) => i.id === target)) {
      setFrontId(target);
      setExpandedId(target);
      setFaceFlipped((previous) => new Set(previous).add(target));
      // Wait for React to reorder/expand the stack before measuring its new
      // height, then reveal the selected card at the bottom of Wallet.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const scroller = cardStackScrollRef.current;
          if (!scroller) return;
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        });
      });
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


  if (loading) return <ScreenLoader />;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden pb-24">
      <TabTransition className="flex flex-1 flex-col">
      <header className="relative flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to="/profile" aria-label="Open your profile" className="shrink-0">
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
        <div className="flex shrink-0 items-center gap-2">
          <SpacesButton />
          <NotificationButton scope="customer" />
        </div>

      </header>

      {!profileLoading && profile && missingProfileFields.length > 0 ? (
        <section className="relative px-5 pb-3" aria-labelledby="complete-profile-title">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md"
          >
            <Link
              to="/profile"
              search={{ edit: true }}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 shadow-sm transition-colors hover:bg-primary/15"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserRoundPen className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="complete-profile-title" className="truncate text-sm font-semibold">
                  Complete profile
                </h2>
                <p className="truncate text-[11px] text-muted-foreground" aria-label="Missing information">
                  {missingProfileFields.map((field) => (
                    <span key={field}>
                      {field !== missingProfileFields[0] ? <span aria-hidden="true"> · </span> : null}
                      <span>{field}</span>
                    </span>
                  ))}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </motion.div>
        </section>
      ) : null}

      {profile ? (
        <div className="relative px-5 pb-4">
          <CustomerQrCard
            qrToken={profile.customerQrToken}
            userId={profile.id}
          />
        </div>
      ) : null}

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
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 font-display text-lg font-bold">
              <CreditCard className="h-4 w-4" /> My cards
            </h1>
            {instances.length > 1 && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={openArrangeCards}>
                <ArrowUpDown className="h-4 w-4" /> Arrange
              </Button>
            )}
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
          ref={cardStackScrollRef}
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
                              navigate({
                                to: "/b/$businessId",
                                params: { businessId: inst.template.business.id },
                              });
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
                              navigate({
                                to: "/b/$businessId",
                                params: { businessId: inst.template.business.id },
                              });
                            } else {
                              setFrontId(inst.id);
                              setExpandedId(inst.id);
                            }
                          }}
                          className="relative block w-full text-left focus:outline-none"
                          aria-label={
                            isExpanded
                              ? `Open ${inst.template.business.name}`
                              : `Bring ${inst.template.title} forward`
                          }
                        >
                          <div className="relative">
                            <div className={isFrozen ? "opacity-75" : undefined}>
                              <StampCard
                                title={inst.template.title}
                                subtitle={inst.template.subtitle}
                                cornerTitle={inst.template.corner_title}
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
                                disableShadow
                                face={faceFlipped.has(inst.id) ? "stamps" : "info"}
                                showFlipButton={i === displayInstances.length - 1}
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
        </div>

        </>
      )}



      <AnimatePresence>
        {arranging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 p-5 backdrop-blur-md"
            data-pull-refresh="off"
          >
            <motion.section
              initial={{ scale: 0.94, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="flex max-h-[min(80dvh,640px)] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-card p-5 shadow-xl"
              aria-labelledby="arrange-cards-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="arrange-cards-title" className="font-display text-xl font-bold">Arrange cards</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Drag cards into your preferred order.</p>
                </div>
                <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={cancelArrangeCards} aria-label="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Reorder.Group
                axis="y"
                values={instances}
                onReorder={setInstances}
                className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto py-1"
                layoutScroll
              >
                {instances.map((instance) => (
                  <Reorder.Item
                    key={instance.id}
                    value={instance}
                    className="flex cursor-grab touch-none items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 active:cursor-grabbing"
                    whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.16)" }}
                  >
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: instance.template.accent_color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{instance.template.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{instance.template.business.name}</p>
                    </div>
                    <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Reorder.Item>
                ))}
              </Reorder.Group>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={cancelArrangeCards} disabled={savingOrder}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={finishArrangeCards} disabled={savingOrder}>
                  {savingOrder ? "Saving…" : "Done"}
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebration && (
          <motion.div
            key={`celebrate-${celebration.instanceId}-${celebration.stampsCount}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-ink/85 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setCelebration(null)}
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
                onClick={() => setCelebration(null)}
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
                  <p className="mt-3 text-xs text-muted-foreground">
                    Your card refreshed automatically for the next round.
                  </p>
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
                onClick={() => setCelebration(null)}
              >
                Nice!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </TabTransition>
    </div>
  );
}
