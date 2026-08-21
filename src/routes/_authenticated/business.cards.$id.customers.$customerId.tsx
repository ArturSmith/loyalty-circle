import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { resolveAvatarUrls } from "@/lib/avatar";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Gift,
  Stamp as StampIco,
  Ticket,
  Clock,
} from "lucide-react";

type Reward = { step: number; label?: string | null };

type Tpl = {
  id: string;
  title: string;
  total_steps: number;
  rewards: Reward[] | null;
};

type Instance = {
  id: string;
  stamps_count: number;
  completed_at: string | null;
  created_at: string;
};

type Stamp = { id: string; step_number: number; created_at: string };
type Voucher = {
  id: string;
  label: string;
  status: string;
  step_number: number;
  created_at: string;
  redeemed_at: string | null;
};

export const Route = createFileRoute("/_authenticated/business/cards/$id/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer activity — ClubCarder" },
      { name: "description", content: "Detailed history of a customer's stamps, rewards and vouchers on this loyalty card." },
      { property: "og:title", content: "Customer activity — ClubCarder" },
      { property: "og:description", content: "Detailed history of a customer's stamps, rewards and vouchers on this loyalty card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetails,
});

const fmtDT = (d: string | null) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

function CustomerDetails() {
  const { id, customerId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null }>({
    display_name: null,
    avatar_url: null,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: inst }, { data: prof }] = await Promise.all([
        supabase.from("card_templates").select("id,title,total_steps,rewards").eq("id", id).maybeSingle(),
        supabase
          .from("card_instances")
          .select("id,stamps_count,completed_at,created_at")
          .eq("template_id", id)
          .eq("customer_id", customerId)
          .maybeSingle(),
        supabase.from("profiles").select("display_name,avatar_url").eq("id", customerId).maybeSingle(),
      ]);

      setTpl((t as Tpl | null) ?? null);
      setInstance((inst as Instance | null) ?? null);

      if (prof) {
        const map = await resolveAvatarUrls([prof.avatar_url]);
        setProfile({
          display_name: prof.display_name,
          avatar_url: prof.avatar_url ? (map.get(prof.avatar_url) ?? null) : null,
        });
      }

      if (inst) {
        const [{ data: st }, { data: vs }] = await Promise.all([
          supabase
            .from("stamps")
            .select("id,step_number,created_at")
            .eq("card_instance_id", (inst as Instance).id)
            .order("created_at", { ascending: false }),
          supabase
            .from("vouchers")
            .select("id,label,status,step_number,created_at,redeemed_at")
            .eq("template_id", id)
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),
        ]);
        setStamps((st as Stamp[] | null) ?? []);
        setVouchers((vs as Voucher[] | null) ?? []);
      }
      setLoading(false);
    })();
  }, [id, customerId]);

  if (loading) return <ScreenLoader />;

  if (!tpl || !instance)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>This customer has no card yet.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/business/cards/$id", params: { id } })}>
          Back to card
        </Button>
      </div>
    );

  const rewards = (tpl.rewards ?? []).slice().sort((a, b) => a.step - b.step);
  const earned = rewards.filter((r) => r.step <= instance.stamps_count);
  const upcoming = rewards.filter((r) => r.step > instance.stamps_count);
  const nextReward = upcoming[0] ?? null;
  const stepsToNext = nextReward ? nextReward.step - instance.stamps_count : null;

  // visit cadence
  const sorted = stamps.slice().sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  let avgDays: number | null = null;
  if (sorted.length > 1) {
    const spanMs = +new Date(sorted[sorted.length - 1].created_at) - +new Date(sorted[0].created_at);
    avgDays = Math.round((spanMs / (sorted.length - 1) / 86400000) * 10) / 10;
  }
  const progress = Math.min(100, Math.round((instance.stamps_count / Math.max(1, tpl.total_steps)) * 100));

  return (
    <div className="min-h-screen px-5 py-6 max-w-3xl mx-auto pb-16">
      <header className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: "/business/cards/$id", params: { id } })}
          className="rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Customer activity</p>
        <div className="w-10" />
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 flex items-center gap-4 rounded-2xl border-2 border-ink/10 bg-card p-4"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile.display_name ?? "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl truncate">{profile.display_name ?? "Customer"}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {tpl.title} • joined {fmt(instance.created_at)}
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl leading-none">
            {instance.stamps_count}
            <span className="text-sm text-muted-foreground">/{tpl.total_steps}</span>
          </div>
          {instance.completed_at && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </div>
          )}
        </div>
      </motion.div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6 }}
          className="h-full rounded-full bg-primary"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={StampIco} label="Visits" value={String(stamps.length)} />
        <Stat icon={Gift} label="Rewards earned" value={String(earned.length)} />
        <Stat icon={Ticket} label="Unused vouchers" value={String(vouchers.filter((v) => v.status === "unused").length)} />
        <Stat icon={Clock} label="Avg. days between" value={avgDays === null ? "—" : String(avgDays)} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl">Coming up</h2>
        {nextReward ? (
          <div className="mt-3 rounded-2xl border-2 border-ink/10 bg-card p-4">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <div className="font-medium truncate">{nextReward.label || `Reward at step ${nextReward.step}`}</div>
                <div className="text-xs text-muted-foreground">
                  {stepsToNext} more {stepsToNext === 1 ? "stamp" : "stamps"} to unlock (step {nextReward.step})
                </div>
              </div>
            </div>
            {upcoming.length > 1 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3">
                {upcoming.slice(1).map((r) => (
                  <li key={r.step} className="text-xs text-muted-foreground">
                    Step {r.step} — {r.label || "Reward"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">All rewards on this card have been unlocked.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Vouchers</h2>
        <div className="mt-3 space-y-2">
          {vouchers.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No vouchers issued yet.
            </div>
          )}
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-3">
              <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{v.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  Issued {fmtDT(v.created_at)}
                  {v.redeemed_at ? ` • Redeemed ${fmtDT(v.redeemed_at)}` : ""}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  v.status === "unused" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {v.status === "unused" ? "Available" : "Used"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Visit history</h2>
        <p className="mt-1 text-xs text-muted-foreground">Every stamp this customer collected, newest first.</p>
        <div className="mt-3 space-y-2">
          {stamps.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No stamps yet.
            </div>
          )}
          {stamps.map((s) => {
            const reward = rewards.find((r) => r.step === s.step_number);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {s.step_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Stamp {s.step_number}</div>
                  {reward && (
                    <div className="text-[11px] text-primary">Unlocked: {reward.label || "Reward"}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> {fmtDT(s.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-card p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-2 font-display text-2xl">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
