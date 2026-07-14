import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { QrDisplay } from "@/components/QrDisplay";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, LogOut, Sparkles, Store, X } from "lucide-react";
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

function Wallet() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [emblaRef, embla] = useEmblaCarousel({ align: "center", loop: false });
  const [selected, setSelected] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("card_instances")
      .select(`id, stamps_count, completed_at, created_at,
        template:card_templates!inner(id, title, subtitle, total_steps, shape, bg_color, accent_color, text_color, stamp_icon, logo_url, rewards,
          business:businesses!inner(id, name))`)
      .order("created_at", { ascending: false });
    setInstances((data as unknown as Instance[]) ?? []);
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

  useEffect(() => {
    if (!embla) return;
    const onSel = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSel);
    return () => { embla.off("select", onSel); };
  }, [embla]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/" }); };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your wallet…</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">My Wallet</h1>
          <p className="text-xs text-muted-foreground">Tap a card to show your QR</p>
        </div>
        <div className="flex gap-1">
          <Link to="/business"><Button variant="ghost" size="icon" title="Business"><Store className="h-4 w-4" /></Button></Link>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {instances.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <OrnamentDivider className="w-32 opacity-60" />
          <h2 className="mt-6 font-display text-2xl">No cards yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">Scan a business's QR to add your first loyalty card.</p>
          <OrnamentDivider className="w-32 mt-6 opacity-60" />
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
    </div>
  );
}
