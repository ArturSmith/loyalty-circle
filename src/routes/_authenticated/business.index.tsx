import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrDisplay } from "@/components/QrDisplay";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Plus, QrCode, ScanLine, Users, Stamp as StampIco, Wallet as WalletIcon, Pencil, Menu, Download, Sparkles, ArrowLeft, RefreshCcw, TicketCheck, UserPlus } from "lucide-react";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import QRCode from "qrcode";
import { normalizeBrandColor } from "@/lib/brand";
import { z } from "zod";
import { BusinessSummaryStat } from "@/components/business/BusinessSummaryStat";
import { NotificationButton } from "@/components/NotificationButton";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";
import { AnalyticsMetricCard } from "@/components/business/AnalyticsMetricCard";
import { parseBusinessAnalytics, type BusinessAnalytics } from "@/lib/business-analytics";


type Business = {
  id: string;
  owner_id: string;
  accepted_by_platform: boolean;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
};
type Tpl = {
  id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; active: boolean;
  shape: CardShape;
  bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[] | null; grid_cols: number | null;
};
type DashboardCache = {
  biz: Business | null;
  tpls: Tpl[];
  stats: { stamps: number; customers: number; active: number };
  analytics: BusinessAnalytics | null;
};

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({ meta: [{ title: "Business dashboard — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid().optional() }),
  component: BusinessDashboard,
});

function BusinessDashboard() {
  const { businessId: selectedBusinessId } = Route.useSearch();
  const cacheKey = `business-dashboard:${selectedBusinessId ?? "default"}`;
  const cached = getNavigationCache<DashboardCache>(cacheKey);
  const [biz, setBiz] = useState<Business | null>(() => cached?.value.biz ?? null);
  const [tpls, setTpls] = useState<Tpl[]>(() => cached?.value.tpls ?? []);
  const [stats, setStats] = useState(() => cached?.value.stats ?? { stamps: 0, customers: 0, active: 0 });
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(() => cached?.value.analytics ?? null);
  const [loading, setLoading] = useState(() => cached === null);
  const [showQr, setShowQr] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const permissions = useBusinessPermissions(biz?.id);



  useEffect(() => {
    let cancelled = false;
    const snapshot = getNavigationCache<DashboardCache>(cacheKey);
    if (snapshot) {
      setBiz(snapshot.value.biz);
      setTpls(snapshot.value.tpls);
      setStats(snapshot.value.stats);
      setAnalytics(snapshot.value.analytics ?? null);
      setLoading(false);
    } else {
      setBiz(null);
      setTpls([]);
      setStats({ stamps: 0, customers: 0, active: 0 });
      setAnalytics(null);
      setLoading(true);
    }
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      // limit(1) matters: maybeSingle() errors outright when the account owns
      // more than one business, which would look identical to owning none and
      // bounce the user into the onboarding wizard.
      let b;
      if (selectedBusinessId) {
        // The select is still protected by RLS, so a hand-edited URL cannot
        // open a business the signed-in user is unrelated to.
        const { data } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", selectedBusinessId)
          .maybeSingle();
        b = data;
      } else {
        const { data } = await supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", u.user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        b = data;
      }
      if (!b && !selectedBusinessId) {
        // Invited administrators own no business — resolve the one they were
        // added to, otherwise they would be shown the "create a business" form.
        const { data: membership } = await (supabase as any)
          .from("business_members")
          .select("business_id")
          .eq("user_id", u.user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        const memberBusinessId = (membership as { business_id?: string } | null)?.business_id;
        if (memberBusinessId) {
          const { data: memberBiz } = await supabase
            .from("businesses")
            .select("*")
            .eq("id", memberBusinessId)
            .maybeSingle();
          b = memberBiz;
        }
      }
      const nextBiz = b as Business | null;
      let nextTemplates: Tpl[] = [];
      let nextStats = { stamps: 0, customers: 0, active: 0 };
      let nextAnalytics: BusinessAnalytics | null = null;
      if (b?.accepted_by_platform) {
        const [{ data: t }, { data: dashboardStats }, { data: canViewAnalytics }] = await Promise.all([
          supabase.from("card_templates").select("id,title,subtitle,description,corner_title,total_steps,active,shape,bg_color,accent_color,text_color,stamp_icon,logo_url,rewards,grid_cols").eq("business_id", b.id).order("created_at", { ascending: false }),
          supabase.rpc("get_business_dashboard_stats", { _business_id: b.id }),
          supabase.rpc("can_on_business", { _business_id: b.id, _permission: "analytics.view" }),
        ]);
        nextTemplates = (t as Tpl[]) ?? [];
        const basic = (dashboardStats ?? {}) as { stamps?: number; customers?: number; active?: number };
        nextStats = { stamps: basic.stamps ?? 0, customers: basic.customers ?? 0, active: basic.active ?? 0 };
        if (canViewAnalytics) {
          const { data: analyticsData } = await supabase.rpc("get_business_value_analytics", {
            _business_id: b.id,
            _range_days: 30,
          });
          if (analyticsData) nextAnalytics = parseBusinessAnalytics(analyticsData, 30);
        }
      }
      if (cancelled) return;
      setBiz(nextBiz);
      setTpls(nextTemplates);
      setStats(nextStats);
      setAnalytics(nextAnalytics);
      setNavigationCache<DashboardCache>(cacheKey, {
        biz: nextBiz,
        tpls: nextTemplates,
        stats: nextStats,
        analytics: nextAnalytics,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, selectedBusinessId]);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const downloadBusinessQr = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(bizUrl, {
        width: 1024,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffffff" },
        errorCorrectionLevel: "M",
      });
      const a = document.createElement("a");
      const safeName = (biz?.name || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      a.href = dataUrl;
      a.download = `${safeName || "business"}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Could not download QR image");
    }
  };

  if (loading) return <ScreenLoader />;

  // Business creation now lives in the onboarding wizard, so there is exactly
  // one path into the product and `onboarding_step` is always meaningful.
  if (!biz) {
    return <Navigate to={selectedBusinessId ? "/workspace" : "/business/onboarding"} replace />;
  }
  if (!biz.accepted_by_platform) {
    return <Navigate to="/business/review" search={{ businessId: biz.id }} replace />;
  }
  if (permissions.loading) return <ScreenLoader />;


  // Always point QR codes at the published site so scanners never hit the
  // Lovable editor preview (which requires a Lovable login).
  const PUBLIC_SITE_URL = "https://clubcarder.com";
  const bizUrl = `${PUBLIC_SITE_URL}/b/${biz.id}`;
  const isOwner = permissions.isOwner;

  return (
    <div className="min-h-screen px-5 py-6 max-w-3xl mx-auto">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
        <p className="min-w-0 text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2">
            {/* A swatch of the brand colour, so the owner can see the value
                they picked is actually in use rather than write-only. */}
            {normalizeBrandColor(biz.brand_color) && (
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: normalizeBrandColor(biz.brand_color)! }}
                aria-hidden="true"
              />
            )}
            <h1 className="min-w-0 max-w-full font-display text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
              {biz.name}
            </h1>
            <PlanBadge isOwner={isOwner} />
        </div>
        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2">
          <NotificationButton scope="business" businessId={biz.id} />
          <Button asChild variant="ghost" size="icon" className="rounded-full glass-panel">
            <Link to="/business/menu" search={{ businessId: biz.id }} aria-label="Open menu" title="Menu">
              <Menu className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="outline" onClick={() => setShowQr((v) => !v)} className="h-auto flex-col gap-1.5 py-3 rounded-2xl glass-panel">
          <QrCode className="h-5 w-5" />
          <span className="text-xs font-semibold">Business QR</span>
        </Button>
        {permissions.has("cards.stamp") && (
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-3 rounded-2xl glass-panel">
            <Link to="/business/scan" search={{ businessId: biz.id }}>
              <ScanLine className="h-5 w-5" />
              <span className="text-xs font-semibold">Scan customer</span>
            </Link>
          </Button>
        )}
        {permissions.has("customers.view") && (
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-3 rounded-2xl glass-panel">
            <Link to="/business/customers" search={{ businessId: biz.id }}>
              <Users className="h-5 w-5" />
              <span className="text-xs font-semibold">Customers</span>
            </Link>
          </Button>
        )}
        {permissions.has("cards.manage") && (
          <Button asChild className="h-auto flex-col gap-1.5 py-3 rounded-2xl bg-primary text-primary-foreground border-0 hover:bg-primary/90">
            <Link to="/business/cards/new" search={{ businessId: biz.id }}>
              <Plus className="h-5 w-5" />
              <span className="text-xs font-semibold">New card</span>
            </Link>
          </Button>
        )}
      </div>

      {showQr && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="mt-6 rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-6 text-center">
          <OrnamentDivider className="w-40 mx-auto opacity-60" />
          <h3 className="font-display text-xl mt-2">Your business QR</h3>
          <p className="text-xs text-muted-foreground">Customers scan this to see and claim your cards.</p>
          <div className="mt-4 flex justify-center"><QrDisplay value={bizUrl} size={220} /></div>
          <p className="mt-3 text-xs text-muted-foreground break-all">{bizUrl}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={downloadBusinessQr}>
            <Download className="h-4 w-4" /> Download QR image
          </Button>
        </motion.div>
      )}

      {permissions.has("analytics.view") && analytics ? (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Last 30 days</h2>
              <p className="mt-1 text-xs text-muted-foreground">The value your loyalty programs are creating.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full">
              <Link to="/business/analytics" search={{ businessId: biz.id }}>
                View analytics <ArrowLeft className="ml-1 h-3.5 w-3.5 rotate-180" />
              </Link>
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AnalyticsMetricCard
              icon={Users}
              label="Active customers"
              value={analytics.current.activeCustomers}
              previous={analytics.previous.activeCustomers}
            />
            <AnalyticsMetricCard
              icon={RefreshCcw}
              label="Return visits"
              value={analytics.current.returnVisits}
              previous={analytics.previous.returnVisits}
            />
            <AnalyticsMetricCard
              icon={UserPlus}
              label="New customers"
              value={analytics.current.newCustomers}
              previous={analytics.previous.newCustomers}
            />
            <AnalyticsMetricCard
              icon={TicketCheck}
              label="Rewards redeemed"
              value={analytics.current.rewardsRedeemed}
              previous={analytics.previous.rewardsRedeemed}
            />
          </div>
        </section>
      ) : (
        <div className="mt-8 grid grid-cols-3 gap-3">
          <BusinessSummaryStat icon={StampIco} label="Stamps issued" value={stats.stamps} />
          <BusinessSummaryStat icon={Users} label="Customers" value={stats.customers} />
          <BusinessSummaryStat icon={WalletIcon} label="Active cards" value={stats.active} />
        </div>
      )}

      <div className="mt-10"><h2 className="font-display text-xl">Your cards</h2></div>

      <div className="mt-4">
        {tpls.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cards yet. Create your first loyalty card to share with customers.
          </div>
        )}

        {tpls.length > 0 && (
          <Carousel
            opts={{ align: "center" }}
            setApi={(api) => setApi(api)}
            className="relative"
          >
            <CarouselContent className="-ml-3">
              {tpls.map((t) => (
                <CarouselItem key={t.id} className="basis-full pl-3">
                  <Link
                    to="/business/cards/$id"
                    params={{ id: t.id }}
                    search={{ businessId: biz.id }}
                    className="group relative block rounded-2xl focus:outline-none focus:ring-2 focus:ring-ink/40"
                  >
                    <StampCard
                      title={t.title}
                      subtitle={t.subtitle}
                      description={t.description}
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
                      rewards={t.rewards ?? []}
                      businessName={biz.name}
                      face={flipped.has(t.id) ? "stamps" : "info"}
                      disableShadow
                      showFlipButton
                      onFlip={() => {
                        setFlipped((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        });
                      }}
                    />
                    {!t.active && (
                      <div className="absolute top-2 left-2 rounded-full bg-background/80 backdrop-blur px-2 py-1 text-[10px] font-medium uppercase tracking-wider shadow-sm">
                        Paused
                      </div>
                    )}
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>

            {tpls.length > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {tpls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => api?.scrollTo(i)}
                    className={`h-2 rounded-full transition-all ${
                      current === i ? "w-5 bg-foreground" : "w-2 bg-foreground/30"
                    }`}
                    aria-label={`Go to card ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </Carousel>
        )}
      </div>
    </div>
  );
}

function PlanBadge({ isOwner }: { isOwner: boolean }) {
  const access = useBusinessAccess();
  const ent = useEntitlements();
  if (!isOwner || access.loading) return null;
  if (access.isSubscribed) {
    // The name comes from the subscription's plan_tier rather than a literal:
    // the badge used to read "Pro", which is not even one of the three plans.
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Sparkles className="h-3 w-3" /> {ent.loading ? "…" : ent.plan.name}
      </span>
    );
  }
  if (access.reason === "trialing" && access.trialDaysLeft != null) {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Trial
      </span>
    );
  }
  return null;
}
