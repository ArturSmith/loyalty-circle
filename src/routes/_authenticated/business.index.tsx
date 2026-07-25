import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrDisplay } from "@/components/QrDisplay";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { Plus, QrCode, ScanLine, Users, Stamp as StampIco, Wallet as WalletIcon, Pencil, Menu, Settings, LogOut, Download, CreditCard, Sparkles } from "lucide-react";
import { useBusinessAccess } from "@/hooks/useBusinessAccess";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import QRCode from "qrcode";

type Business = { id: string; name: string; logo_url: string | null; brand_color: string | null };
type Tpl = {
  id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; active: boolean;
  shape: CardShape;
  bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[] | null; grid_cols: number | null;
};

export const Route = createFileRoute("/_authenticated/business/")({
  head: () => ({ meta: [{ title: "Business dashboard — Stempel" }] }),
  component: BusinessDashboard,
});

function BusinessDashboard() {
  const navigate = useNavigate();
  const [biz, setBiz] = useState<Business | null>(null);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [stats, setStats] = useState({ stamps: 0, customers: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  // create biz form
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [creating, setCreating] = useState(false);


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: b } = await supabase.from("businesses").select("*").eq("owner_id", u.user.id).maybeSingle();
      setBiz(b as Business | null);
      if (b) {
        const [{ data: t }, { count: sCount }, { data: instRows }] = await Promise.all([
          supabase.from("card_templates").select("id,title,subtitle,description,corner_title,total_steps,active,shape,bg_color,accent_color,text_color,stamp_icon,logo_url,rewards,grid_cols").eq("business_id", b.id).order("created_at", { ascending: false }),
          supabase.from("stamps").select("id", { count: "exact", head: true }).eq("business_id", b.id),
          supabase.from("card_instances").select("customer_id, template:card_templates!inner(business_id)").eq("template.business_id", b.id),
        ]);
        setTpls((t as Tpl[]) ?? []);
        const uniq = new Set(((instRows as { customer_id: string }[] | null) ?? []).map((r) => r.customer_id));
        setStats({ stamps: sCount ?? 0, customers: uniq.size, active: (t as Tpl[] | null)?.filter(x => x.active).length ?? 0 });
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const createBiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase.from("businesses").insert({
      owner_id: u.user.id, name, logo_url: logoUrl || null,
    }).select().maybeSingle();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setBiz(data as Business);
    toast.success("Business created");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  if (!biz) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={createBiz}
          className="w-full max-w-sm rounded-2xl border-2 border-ink/10 bg-card paper-grain card-shadow p-8">
          <div className="text-center">
            <OrnamentDivider className="w-32 mx-auto opacity-70" />
            <h1 className="font-display text-2xl mt-3">Create your business</h1>
            <p className="text-sm text-muted-foreground mt-1">Just a name and (optional) logo URL to start.</p>
          </div>
          <div className="mt-6 space-y-3">
            <Input required placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Logo URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <Button type="submit" className="w-full h-11" disabled={creating || !name}>{creating ? "Creating…" : "Create business"}</Button>
          </div>
        </motion.form>
      </div>
    );
  }

  const bizUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${biz.id}` : `/b/${biz.id}`;

  return (
    <div className="min-h-screen px-5 py-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Dashboard</p>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{biz.name}</h1>
            <PlanBadge />
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full glass-panel" title="Menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-2">
              <Link to="/business/edit" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <Settings className="h-4 w-4" /> Edit business info
                </Button>
              </Link>
              <Link to="/settings/billing" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <CreditCard className="h-4 w-4" /> Billing & plan
                </Button>
              </Link>
              <Link to="/wallet" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <WalletIcon className="h-4 w-4" /> My wallet
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={() => setShowQr((v) => !v)} className="h-auto flex-col gap-1.5 py-3 rounded-2xl glass-panel">
          <QrCode className="h-5 w-5" />
          <span className="text-xs font-semibold">Business QR</span>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-3 rounded-2xl glass-panel">
          <Link to="/business/scan">
            <ScanLine className="h-5 w-5" />
            <span className="text-xs font-semibold">Scan customer</span>
          </Link>
        </Button>
        <Button asChild className="h-auto flex-col gap-1.5 py-3 rounded-2xl bg-[image:var(--gradient-primary)] text-white sticker-shadow border-0 hover:opacity-95">
          <Link to="/business/cards/new">
            <Plus className="h-5 w-5" />
            <span className="text-xs font-semibold">New card</span>
          </Link>
        </Button>
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

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat icon={StampIco} label="Stamps issued" value={stats.stamps} />
        <Stat icon={Users} label="Customers" value={stats.customers} />
        <Stat icon={WalletIcon} label="Active cards" value={stats.active} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-xl">Your cards</h2>
      </div>

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

function PlanBadge() {
  const access = useBusinessAccess();
  if (access.loading) return null;
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
