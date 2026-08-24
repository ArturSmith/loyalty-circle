import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { StampCard } from "@/components/StampCard";
import type { CardFace, CardShape, Reward, StampIconName } from "@/components/StampCard";
import { ArrowLeft, Pencil, Users, Stamp as StampIco, CheckCircle2, Calendar, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { resolveAvatarUrls } from "@/lib/avatar";
import { CardAnalytics } from "@/components/CardAnalytics";
import type { AnalyticsInstance, AnalyticsStamp, AnalyticsVoucher, AnalyticsPassEvent } from "@/components/CardAnalytics";


type Tpl = {
  id: string; business_id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; active: boolean; shape: CardShape;
  bg_color: string; accent_color: string; text_color: string; stamp_icon: StampIconName;
  logo_url: string | null; rewards: Reward[] | null; created_at: string; grid_cols: number | null;
};
type Biz = { id: string; name: string; owner_id: string };
type Customer = {
  customer_id: string;
  display_name: string | null;
  avatar_url: string | null;
  stamps_count: number;
  completed_at: string | null;
  last_stamp_at: string | null;
  created_at: string;
  removed_at: string | null;
};


export const Route = createFileRoute("/_authenticated/business/cards/$id/")({
  head: () => ({ meta: [{ title: "Card details — ClubCarder" }] }),
  component: CardDetails,
});

function CardDetails() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [biz, setBiz] = useState<Biz | null>(null);
  const [stats, setStats] = useState({ users: 0, everUsers: 0, stamps: 0, completed: 0, outstandingVouchers: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [face, setFace] = useState<CardFace>("info");
  const [analytics, setAnalytics] = useState<{ instances: AnalyticsInstance[]; stamps: AnalyticsStamp[]; vouchers: AnalyticsVoucher[] }>({ instances: [], stamps: [], vouchers: [] });
  const [passEvents, setPassEvents] = useState<AnalyticsPassEvent[]>([]);



  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from("card_templates").select("*").eq("id", id).maybeSingle();
      if (!t) { setLoading(false); return; }
      setTpl(t as Tpl);
      const { data: b } = await supabase.from("businesses").select("id,name,owner_id").eq("id", (t as Tpl).business_id).maybeSingle();
      setBiz(b as Biz | null);

      // Analytics come from the permanent event log, so history survives a
      // customer deleting the card from their wallet.
      const { data: eventRows } = await supabase
        .from("card_events")
        .select("id,card_instance_id,customer_id,event_type,step_number,metadata,created_at")
        .eq("template_id", id)
        .order("created_at", { ascending: true });

      // Phone-wallet saves/removals. Not in the generated Supabase types yet.
      const { data: walletRows } = await (supabase as any)
        .from("wallet_pass_events")
        .select("card_instance_id,platform,event,created_at")
        .eq("template_id", id);
      setPassEvents((walletRows as AnalyticsPassEvent[] | null) ?? []);

      type Ev = {
        id: string; card_instance_id: string | null; customer_id: string | null;
        event_type: string; step_number: number | null; metadata: Record<string, unknown> | null; created_at: string;
      };
      const events = ((eventRows ?? []) as Ev[]).filter((e) => e.card_instance_id);

      type Agg = {
        id: string; customer_id: string; created_at: string; removed_at: string | null;
        completed_at: string | null; lastResetAt: string; stamps: string[];
      };
      const byInstance = new Map<string, Agg>();
      const ensure = (e: Ev): Agg => {
        let a = byInstance.get(e.card_instance_id!);
        if (!a) {
          a = { id: e.card_instance_id!, customer_id: e.customer_id ?? "", created_at: e.created_at, removed_at: null, completed_at: null, lastResetAt: e.created_at, stamps: [] };
          byInstance.set(a.id, a);
        }
        if (!a.customer_id && e.customer_id) a.customer_id = e.customer_id;
        return a;
      };

      for (const e of events) {
        const a = ensure(e);
        switch (e.event_type) {
          case "card_added": a.created_at = e.created_at; a.lastResetAt = e.created_at; break;
          case "stamp": a.stamps.push(e.created_at); break;
          case "card_completed": a.completed_at = e.created_at; break;
          case "card_renewed": a.lastResetAt = e.created_at; a.completed_at = null; break;
          case "card_removed": a.removed_at = e.created_at; break;
        }
      }

      const aggs = Array.from(byInstance.values()).sort((x, y) => y.created_at.localeCompare(x.created_at));
      const instanceRows: AnalyticsInstance[] = aggs.map((a) => ({
        id: a.id,
        customer_id: a.customer_id,
        stamps_count: a.stamps.filter((s) => s >= a.lastResetAt).length,
        completed_at: a.completed_at,
        created_at: a.created_at,
      }));
      const stampRows: AnalyticsStamp[] = events
        .filter((e) => e.event_type === "stamp")
        .map((e) => ({ card_instance_id: e.card_instance_id!, created_at: e.created_at }));

      const voucherMap = new Map<string, AnalyticsVoucher>();
      for (const e of events) {
        const vid = (e.metadata as { voucher_id?: string } | null)?.voucher_id;
        if (!vid) continue;
        if (e.event_type === "reward_issued") {
          voucherMap.set(vid, { id: vid, customer_id: e.customer_id, status: "unused", created_at: e.created_at, redeemed_at: null });
        } else if (e.event_type === "reward_redeemed") {
          const v = voucherMap.get(vid);
          if (v) { v.status = "used"; v.redeemed_at = e.created_at; }
          else voucherMap.set(vid, { id: vid, customer_id: e.customer_id, status: "used", created_at: e.created_at, redeemed_at: e.created_at });
        }
      }
      const vouchers = Array.from(voucherMap.values());

      const customerIds = Array.from(new Set(aggs.map((a) => a.customer_id).filter(Boolean)));
      const { data: profiles } = customerIds.length
        ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", customerIds)
        : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };

      const profMap = new Map((profiles ?? []).map(p => [p.id, p]));
      const avatarMap = await resolveAvatarUrls((profiles ?? []).map(p => p.avatar_url));

      const list: Customer[] = aggs.map((a) => {
        const p = profMap.get(a.customer_id);
        return {
          customer_id: a.customer_id,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ? (avatarMap.get(p.avatar_url) ?? null) : null,
          stamps_count: a.stamps.filter((s) => s >= a.lastResetAt).length,
          completed_at: a.completed_at,
          last_stamp_at: a.stamps.length ? a.stamps[a.stamps.length - 1] : null,
          created_at: a.created_at,
          removed_at: a.removed_at,
        };
      }).filter((c) => c.customer_id);

      // `aggs` is built from the permanent card_events log, so it includes every
      // instance that ever existed. A customer who removed the card and claimed
      // it again has two instances, so count distinct customers on their
      // still-held instances rather than counting rows.
      const activeCustomerIds = new Set(aggs.filter((a) => !a.removed_at).map((a) => a.customer_id).filter(Boolean));

      setCustomers(list);
      setAnalytics({ instances: instanceRows, stamps: stampRows, vouchers });
      setStats({
        users: activeCustomerIds.size,
        everUsers: customerIds.length,
        stamps: stampRows.length,
        completed: instanceRows.filter(r => r.completed_at).length,
        outstandingVouchers: vouchers.filter(v => v.status === "unused").length,
      });

      setLoading(false);
    })();
  }, [id]);


  if (loading) return <ScreenLoader />;
  if (!tpl || !biz) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>Card not found.</p>
      <Button variant="outline" onClick={() => navigate({ to: "/business" })}>Back to dashboard</Button>
    </div>
  );

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  const fmtDT = (d: string | null) => d ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="min-h-screen px-5 py-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })} className="rounded-full glass-panel">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Card details</p>
        <Link to="/business/cards/$id/edit" params={{ id: tpl.id }}>
          <Button size="sm" className="rounded-full gap-2">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </Link>
      </header>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <StampCard
          title={tpl.title}
          subtitle={tpl.subtitle}
          description={tpl.description}
          cornerTitle={tpl.corner_title}
          totalSteps={tpl.total_steps}
          stampsCount={0}
          shape={tpl.shape}
          gridCols={tpl.grid_cols}
          bgColor={tpl.bg_color}
          accentColor={tpl.accent_color}
          textColor={tpl.text_color}
          stampIcon={tpl.stamp_icon}
          logoUrl={tpl.logo_url}
          rewards={tpl.rewards ?? []}
          businessName={biz.name}
          face={face}
          showFlipButton
          onFlip={() => setFace((f) => f === "info" ? "stamps" : "info")}
        />
      </motion.div>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>Created {fmt(tpl.created_at)}</span>
        <span className="mx-1">•</span>
        <span className={tpl.active ? "text-emerald-600" : ""}>{tpl.active ? "Active" : "Paused"}</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Users}
          label="Active users"
          value={stats.users}
          hint={stats.everUsers > stats.users ? `${stats.everUsers} ever` : undefined}
        />
        <Stat icon={StampIco} label="Stamps" value={stats.stamps} />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completed} />
        <Stat icon={Ticket} label="Vouchers out" value={stats.outstandingVouchers} />
      </div>

      <CardAnalytics totalSteps={tpl.total_steps} instances={analytics.instances} stamps={analytics.stamps} vouchers={analytics.vouchers} passEvents={passEvents} />


      <div className="mt-10">
        <h2 className="font-display text-xl">Customers</h2>
        <p className="text-xs text-muted-foreground mt-1">Who's using this card and when they last stamped.</p>
      </div>

      <div className="mt-4 space-y-2">
        {customers.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No one has claimed this card yet.
          </div>
        )}
        {customers.map((c) => (
          <Link
            key={`${c.customer_id}-${c.created_at}`}
            to="/business/cards/$id/customers/$customerId"
            params={{ id: tpl.id, customerId: c.customer_id }}
            className={`flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card paper-grain p-3 transition-colors hover:bg-muted/40 ${c.removed_at ? "opacity-60" : ""}`}
          >
            <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0">

              {c.avatar_url ? (
                <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (c.display_name ?? "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate flex items-center gap-2">
                {c.display_name ?? "Customer"}
                {c.removed_at && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Removed</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Joined {fmt(c.created_at)} • Last stamp {fmtDT(c.last_stamp_at)}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-display text-lg leading-none">
                {c.stamps_count}<span className="text-muted-foreground text-sm">/{tpl.total_steps}</span>
              </div>
              {c.completed_at && (
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </div>
              )}
            </div>
          </Link>

        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-card paper-grain p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-2 font-display text-2xl">
        {value}
        {hint && <span className="ml-1.5 font-sans text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
