import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";

type Business = { id: string; name: string; logo_url: string | null; brand_color: string | null };
type Template = {
  id: string; business_id: string; title: string; subtitle: string | null;
  total_steps: number; shape: CardShape; bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[]; active: boolean;
};

export const Route = createFileRoute("/b/$businessId")({
  head: () => ({ meta: [{ title: "Claim your card — Stempel" }] }),
  component: BusinessPublic,
});

function BusinessPublic() {
  const { businessId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: t }, { data: u }] = await Promise.all([
        supabase.from("businesses").select("id,name,logo_url,brand_color").eq("id", businessId).maybeSingle(),
        supabase.from("card_templates").select("*").eq("business_id", businessId).eq("active", true).order("created_at"),
        supabase.auth.getUser(),
      ]);
      setBusiness(b as Business | null);
      setTemplates((t as Template[] | null) ?? []);
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: owned } = await supabase
          .from("card_instances")
          .select("template_id")
          .eq("customer_id", uid);
        setOwnedTemplateIds(new Set((owned ?? []).map((r: { template_id: string }) => r.template_id)));
      }
      setLoading(false);
    })();
  }, [businessId]);

  const claim = async (templateId: string) => {
    if (!userId) {
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!business) return <div className="min-h-screen flex items-center justify-center">Business not found.</div>;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md text-center">
        {business.logo_url && <img src={business.logo_url} alt={business.name} className="mx-auto h-16 w-16 rounded-full object-cover ring-1 ring-black/10" />}
        <h1 className="mt-4 font-display text-3xl font-semibold">{business.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a loyalty card to add to your wallet.</p>
        <OrnamentDivider className="w-40 mx-auto my-6 opacity-60" />
      </div>

      <div className="mx-auto max-w-md space-y-6">
        {templates.length === 0 && <p className="text-center text-muted-foreground">No active cards yet.</p>}
        {templates.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <StampCard
              title={t.title}
              subtitle={t.subtitle}
              totalSteps={t.total_steps}
              stampsCount={0}
              shape={t.shape}
              bgColor={t.bg_color}
              accentColor={t.accent_color}
              textColor={t.text_color}
              stampIcon={t.stamp_icon}
              logoUrl={t.logo_url}
              rewards={t.rewards}
              businessName={business.name}
            />
            <Button
              className="mt-3 w-full h-11"
              disabled={claiming === t.id || ownedTemplateIds.has(t.id)}
              onClick={() => claim(t.id)}
            >
              {claiming === t.id
                ? "Adding…"
                : ownedTemplateIds.has(t.id)
                ? "Already in your wallet"
                : userId
                ? "Add to my wallet"
                : "Sign in to add"}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
