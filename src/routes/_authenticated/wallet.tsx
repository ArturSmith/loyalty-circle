import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Gift, LogOut, Menu, ScanLine, Sparkles, Store, User, X } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";

type Instance = {
  id: string; stamps_count: number; completed_at: string | null; created_at: string;
  template: {
    id: string; title: string; subtitle: string | null; total_steps: number; shape: CardShape;
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
  const [loading, setLoading] = useState(true);
  const [emblaRef, embla] = useEmblaCarousel({ align: "center", loop: false });
  const [selected, setSelected] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setInstances([]); setLoading(false); return; }
    const { data } = await supabase
      .from("card_instances")
      .select(`id, stamps_count, completed_at, created_at,
        template:card_templates!inner(id, title, subtitle, total_steps, shape, bg_color, accent_color, text_color, stamp_icon, logo_url, rewards,
          business:businesses!inner(id, name))`)
      .eq("customer_id", u.user.id)
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
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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


  useEffect(() => {
    if (!embla) return;
    const onSel = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSel);
    return () => { embla.off("select", onSel); };
  }, [embla]);

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
          <div className="flex-1 overflow-hidden py-6" ref={emblaRef}>
            <div className="flex touch-pan-y">
              {instances.map((inst, i) => (
                <div key={inst.id} className="min-w-0 flex-[0_0_88%] px-2 sm:flex-[0_0_420px]">
                  <motion.button
                    className="w-full text-left focus:outline-none"
                    animate={{ scale: selected === i ? 1 : 0.94, opacity: selected === i ? 1 : 0.5 }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                    onClick={() => setFlippedId(inst.id)}
                  >
                    <StampCard
                      title={inst.template.title}
                      subtitle={inst.template.subtitle}
                      totalSteps={inst.template.total_steps}
                      stampsCount={inst.stamps_count}
                      shape={inst.template.shape}
                      bgColor={inst.template.bg_color}
                      accentColor={inst.template.accent_color}
                      textColor={inst.template.text_color}
                      stampIcon={inst.template.stamp_icon}
                      logoUrl={inst.template.logo_url}
                      rewards={inst.template.rewards}
                      businessName={inst.template.business.name}
                      lastStamp={inst.stamps_count}
                    />
                  </motion.button>
                  {inst.completed_at && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gold">
                      <Sparkles className="h-3 w-3" /> Card complete — reward unlocked
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pb-4">
            <Button size="icon" variant="ghost" onClick={() => embla?.scrollPrev()}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground">{selected + 1} / {instances.length}</span>
            <Button size="icon" variant="ghost" onClick={() => embla?.scrollNext()}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </>
      )}

      <AnimatePresence>
        {flippedId && (
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
              <h3 className="font-display text-2xl mt-3">Show to stamp</h3>
              <p className="text-xs text-muted-foreground">Let the business scan this code</p>
              <div className="mt-6 flex justify-center">
                <QrDisplay value={`stempel:card:${flippedId}`} size={260} />
              </div>
              <OrnamentDivider className="w-40 mx-auto mt-6 opacity-70" />
            </motion.div>
          </motion.div>
        )}
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
