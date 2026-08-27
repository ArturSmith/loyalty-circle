import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { postSignOutDestination } from "@/lib/post-sign-out";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrDisplay } from "@/components/QrDisplay";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Plus, QrCode, ScanLine, Search, Users, Stamp as StampIco, Wallet as WalletIcon, Pencil, Menu, Settings, LogOut, Download, CreditCard, Sparkles, HelpCircle, Mail, ArrowLeft, MessageCircle, Building2 } from "lucide-react";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import QRCode from "qrcode";
import { normalizeBrandColor } from "@/lib/brand";
import { z } from "zod";


type Business = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  onboarding_step?: number | null;
  onboarding_completed_at?: string | null;
};
type Tpl = {
  id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; active: boolean;
  shape: CardShape;
  bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[] | null; grid_cols: number | null;
};

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({ meta: [{ title: "Business dashboard — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid().optional() }),
  component: BusinessDashboard,
});

function BusinessDashboard() {
  const navigate = useNavigate();
  const { businessId: selectedBusinessId } = Route.useSearch();
  const unreadChats = useUnreadChatCount("business");
  const [biz, setBiz] = useState<Business | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [stats, setStats] = useState({ stamps: 0, customers: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const permissions = useBusinessPermissions(biz?.id);



  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
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
      setBiz(b as Business | null);
      if (b) {
        const [{ data: t }, { data: dashboardStats }] = await Promise.all([
          supabase.from("card_templates").select("id,title,subtitle,description,corner_title,total_steps,active,shape,bg_color,accent_color,text_color,stamp_icon,logo_url,rewards,grid_cols").eq("business_id", b.id).order("created_at", { ascending: false }),
          supabase.rpc("get_business_dashboard_stats", { _business_id: b.id }),
        ]);
        setTpls((t as Tpl[]) ?? []);
        const basic = (dashboardStats ?? {}) as { stamps?: number; customers?: number; active?: number };
        setStats({ stamps: basic.stamps ?? 0, customers: basic.customers ?? 0, active: basic.active ?? 0 });
      }
      setLoading(false);
    })();
  }, [selectedBusinessId]);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: postSignOutDestination(), replace: true });
  };

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

  if (loading || (biz && permissions.loading)) return <ScreenLoader />;

  // Business creation now lives in the onboarding wizard, so there is exactly
  // one path into the product and `onboarding_step` is always meaningful.
  if (!biz) {
    return <Navigate to={selectedBusinessId ? "/workspace" : "/business/onboarding"} replace />;
  }


  // Always point QR codes at the published site so scanners never hit the
  // Lovable editor preview (which requires a Lovable login).
  const PUBLIC_SITE_URL = "https://clubcarder.com";
  const bizUrl = `${PUBLIC_SITE_URL}/b/${biz.id}`;
  const isOwner = permissions.isOwner;
  const canEditSettings = isOwner || permissions.hasAny(["locations.manage", "marketplace.manage"]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
          <div className="flex items-center gap-2">
            {/* A swatch of the brand colour, so the owner can see the value
                they picked is actually in use rather than write-only. */}
            {normalizeBrandColor(biz.brand_color) && (
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: normalizeBrandColor(biz.brand_color)! }}
                aria-hidden="true"
              />
            )}
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{biz.name}</h1>
            <PlanBadge isOwner={isOwner} />
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="rounded-full glass-panel" title="Menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-2">
              <Link to="/business/workspace" search={{ businessId: biz.id }} className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Building2 className="h-4 w-4" /> Team
                </Button>
              </Link>
              {permissions.has("customers.message") && (
                <Link to="/business/chats" search={{ businessId: biz.id }} className="w-full">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <MessageCircle className="h-4 w-4" /> Messages
                    {unreadChats > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground">
                        {unreadChats > 9 ? "9+" : unreadChats}
                      </span>
                    )}
                  </Button>
                </Link>
              )}
              {canEditSettings && (
                <Link to="/business/edit" search={{ businessId: biz.id }} className="w-full">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Settings className="h-4 w-4" /> Edit business info
                  </Button>
                </Link>
              )}
              {isOwner && (
                <Link to="/business/team" search={{ businessId: biz.id }} className="w-full">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <Users className="h-4 w-4" /> Team & permissions
                  </Button>
                </Link>
              )}
              {isOwner && (
                <Link to="/settings/billing" className="w-full">
                  <Button variant="ghost" className="w-full justify-start gap-3">
                    <CreditCard className="h-4 w-4" /> Billing & plan
                  </Button>
                </Link>
              )}
              <Link to="/wallet" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <WalletIcon className="h-4 w-4" /> My wallet
                </Button>
              </Link>
              <Link to="/help" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <HelpCircle className="h-4 w-4" /> Help
                </Button>
              </Link>
              <Link to="/contact" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Mail className="h-4 w-4" /> Contact us
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
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
              <Search className="h-5 w-5" />
              <span className="text-xs font-semibold">Find customer</span>
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

      {/* Someone who abandoned the wizard has no other way back into it. */}
      {isOwner && !biz.onboarding_completed_at && (
        <Link
          to="/business/onboarding"
          className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink/15 bg-card/60 p-4 transition-colors hover:bg-muted/40"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Finish setting up your business</span>
            <span className="block text-xs text-muted-foreground">
              Step {Math.min(biz.onboarding_step ?? 1, 8)} of 8 — locations, team and your public listing.
            </span>
          </span>
          <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat icon={StampIco} label="Stamps issued" value={stats.stamps} />
        <Stat icon={Users} label="Customers" value={stats.customers} />
        <Stat icon={WalletIcon} label="Active cards" value={stats.active} />
      </div>

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

function Stat({ icon: Icon, label, value }: { icon: typeof QrCode; label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-card paper-grain p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-2 font-display text-2xl">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function PlanBadge({ isOwner }: { isOwner: boolean }) {
  const access = useBusinessAccess();
  if (!isOwner || access.loading) return null;
  if (access.isSubscribed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Sparkles className="h-3 w-3" /> Pro
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
