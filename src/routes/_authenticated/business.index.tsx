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
import { Plus, QrCode, ScanLine, Users, Stamp as StampIco, Wallet as WalletIcon, Pencil, Menu, Settings } from "lucide-react";

type Business = { id: string; name: string; logo_url: string | null; brand_color: string | null };
type Tpl = { id: string; title: string; total_steps: number; active: boolean };

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
          supabase.from("card_templates").select("id,title,total_steps,active").eq("business_id", b.id).order("created_at", { ascending: false }),
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
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{biz.name}</h1>
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
              <Link to="/wallet" className="w-full">
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <WalletIcon className="h-4 w-4" /> My wallet
                </Button>
              </Link>
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

      <div className="mt-4 grid gap-3">
        {tpls.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cards yet. Create your first loyalty card to share with customers.
          </div>
        )}
        {tpls.map((t) => (
          <Link key={t.id} to="/business/cards/$id/edit" params={{ id: t.id }}
            className="flex items-center justify-between rounded-xl border-2 border-ink/10 bg-card paper-grain p-4 hover:border-ink/20 transition-colors">
            <div>
              <div className="font-display text-lg">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.total_steps} steps · {t.active ? "active" : "paused"}</div>
            </div>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
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
