import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";

type Template = {
  id: string; business_id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; shape: CardShape;
  bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[]; active: boolean; grid_cols: number | null;
};

export const Route = createFileRoute("/b/$businessId")({
  head: () => ({ meta: [{ title: "Claim your card — Stempel" }] }),
  component: BusinessPublic,
});

function BusinessPublic() {
  const { businessId } = Route.useParams();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Map<string, string>>(new Map());
  const [flippedTemplateId, setFlippedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: u }] = await Promise.all([
        supabase.from("card_templates").select("*").eq("business_id", businessId).eq("active", true).order("created_at"),
        supabase.auth.getUser(),
      ]);
      setTemplates((t as Template[] | null) ?? []);
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: owned } = await supabase
          .from("card_instances")
          .select("id, template_id")
          .eq("customer_id", uid);
        const m = new Map<string, string>();
        (owned ?? []).forEach((r: { id: string; template_id: string }) => m.set(r.template_id, r.id));
        setOwnedTemplateIds(m);
      }
      setLoading(false);
    })();
  }, [businessId]);

  const claim = async (templateId: string) => {
    if (!userId) {
      try { sessionStorage.setItem(`pending_claim:${businessId}`, templateId); } catch {}
      navigate({ to: "/auth", search: { redirect: `/b/${businessId}` } });
      return;
    }
    setClaiming(templateId);
    const { data: existing } = await supabase.from("card_instances").select("id").eq("template_id", templateId).eq("customer_id", userId).maybeSingle();
    if (existing) {
      navigate({ to: "/wallet" });
      return;
    }
    const { error } = await supabase.from("card_instances").insert({ template_id: templateId, customer_id: userId });
    setClaiming(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Card added to your wallet");
    navigate({ to: "/wallet" });
  };

  // Auto-claim after signing in via redirect back
  useEffect(() => {
    if (!userId || loading || templates.length === 0) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(`pending_claim:${businessId}`); } catch {}
    if (!pending) return;
    try { sessionStorage.removeItem(`pending_claim:${businessId}`); } catch {}
    if (ownedTemplateIds.has(pending)) { navigate({ to: "/wallet" }); return; }
    if (templates.find((t) => t.id === pending)) {
      claim(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading, templates, businessId]);


  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (templates.length === 0) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <h1 className="mt-4 font-display text-3xl font-semibold">Loyalty cards</h1>
          <p className="mt-2 text-sm text-muted-foreground">No active cards available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mt-4 font-display text-3xl font-semibold">Loyalty cards</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a loyalty card to add to your wallet.</p>
        <OrnamentDivider className="w-40 mx-auto my-6 opacity-60" />
      </div>

      <div className="mx-auto max-w-md space-y-6">
        {templates.map((t, i) => {
          const ownedInstanceId = ownedTemplateIds.get(t.id);
          const handleCardClick = () => {
            if (!userId) {
              try { sessionStorage.setItem(`pending_claim:${businessId}`, t.id); } catch {}
              navigate({ to: "/auth", search: { redirect: `/b/${businessId}` } });
              return;
            }
            if (ownedInstanceId) {
              try { sessionStorage.setItem("open_card_id", ownedInstanceId); } catch {}
              navigate({ to: "/wallet" });
              return;
            }
            claim(t.id);
          };
          return (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <button
              type="button"
              onClick={handleCardClick}
              className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
              aria-label={ownedInstanceId ? `Open ${t.title} in your wallet` : userId ? `Add ${t.title} to your wallet` : `Sign in to add ${t.title}`}
            >
              <StampCard
                title={t.title}
                subtitle={t.subtitle}
                cornerTitle={t.corner_title}
                totalSteps={t.total_steps}
                stampsCount={0}
                shape={t.shape}
                gridCols={t.grid_cols}
                bgColor={t.bg_color}
                accentColor={t.accent_color}
                textColor={t.text_color}
                stampIcon={t.stamp_icon}
                logoUrl={t.logo_url}
                rewards={t.rewards}
                face={flippedTemplateId === t.id ? "stamps" : "info"}
                showFlipButton
                onFlip={() => setFlippedTemplateId((prev) => prev === t.id ? null : t.id)}
              />
            </button>
            <Button
              className="mt-3 w-full h-11"
              disabled={claiming === t.id}
              onClick={handleCardClick}
            >
              {claiming === t.id
                ? "Adding…"
                : ownedInstanceId
                ? "Open in my wallet"
                : userId
                ? "Add to my wallet"
                : "Sign in to add"}
            </Button>
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
