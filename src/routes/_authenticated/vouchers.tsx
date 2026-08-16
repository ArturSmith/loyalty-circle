import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, MapPin, Phone, Globe, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { QrDisplay } from "@/components/QrDisplay";
import { supabase } from "@/integrations/supabase/client";
import { hapticTap } from "@/lib/native";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { getMyVouchers } from "@/utils/vouchers.functions";
import type { MyVoucher } from "@/utils/vouchers.functions";

export const Route = createFileRoute("/_authenticated/vouchers")({
  head: () => ({
    meta: [
      { title: "My vouchers — ClubCarder" },
      { name: "description", content: "All the rewards you've unlocked: show a voucher to the business to redeem it." },
      { property: "og:title", content: "My vouchers — ClubCarder" },
      { property: "og:description", content: "All the rewards you've unlocked with your ClubCarder loyalty cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VouchersPage,
});

function addressOf(b: MyVoucher["business"]) {
  if (!b) return null;
  const parts = [b.address_line1, b.address_line2, [b.postal_code, b.city].filter(Boolean).join(" "), b.country];
  const text = parts.filter(Boolean).join(", ");
  return text || null;
}

function VouchersPage() {
  const navigate = useNavigate();
  const load = useServerFn(getMyVouchers);
  const [vouchers, setVouchers] = useState<MyVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unused" | "used">("unused");
  const [openId, setOpenId] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<MyVoucher | null>(null);
  // Statuses from the previous fetch, so we can spot the moment the business
  // redeems a voucher. Starts undefined so the first load never celebrates.
  const seenStatus = useRef<Map<string, MyVoucher["status"]> | null>(null);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      try {
        const rows = await load({});
        if (!alive) return;

        const previous = seenStatus.current;
        if (previous) {
          // The business just scanned this voucher — celebrate it.
          const justUsed = rows.find(
            (v) => v.status === "used" && previous.get(v.id) === "unused",
          );
          if (justUsed) {
            setRedeemed(justUsed);
            setOpenId(null); // the QR modal is spent, swap it for the animation
            void hapticTap();
          }
        }
        seenStatus.current = new Map(rows.map((v) => [v.id, v.status]));

        setVouchers(rows);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();

    // The customer is standing at the counter watching, so poll alone is too
    // slow — realtime makes redemption feel immediate, with the poll as backup.
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!alive || !userId) return;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (!alive) return;
      channel = supabase
        .channel(`vouchers:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "vouchers", filter: `customer_id=eq.${userId}` },
          () => void run(),
        )
        .subscribe();
    })();

    const t = setInterval(run, 6000);
    return () => {
      alive = false;
      clearInterval(t);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  // Auto-dismiss the redemption celebration.
  useEffect(() => {
    if (!redeemed) return;
    const t = setTimeout(() => setRedeemed(null), 6000);
    return () => clearTimeout(t);
  }, [redeemed]);

  const list = useMemo(() => vouchers.filter((v) => v.status === tab), [vouchers, tab]);
  const open = vouchers.find((v) => v.id === openId) ?? null;
  const unusedCount = vouchers.filter((v) => v.status === "unused").length;

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="min-h-screen pb-24">
      <header className="flex items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/profile" })} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-semibold">My vouchers</h1>
          <p className="text-xs text-muted-foreground">
            {unusedCount > 0 ? `${unusedCount} ready to use` : "Rewards you unlock appear here"}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-5">
        <div className="flex rounded-full border border-border p-1 text-sm">
          {(["unused", "used"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full py-2 font-medium capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "unused" ? "Available" : "Used"}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}

          {!loading && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {tab === "unused" ? "No vouchers yet — keep collecting stamps." : "No used vouchers yet."}
            </div>
          )}

          {list.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => v.status === "unused" && setOpenId(v.id)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${v.accent_color}1a`, color: v.accent_color }}
                >
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{v.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.business?.name ?? "Business"} • {v.card_title}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {v.status === "used" ? `Used ${fmt(v.redeemed_at)}` : `Unlocked ${fmt(v.created_at)} — tap to show QR`}
                  </div>
                </div>
                {v.status === "used" && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Used
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-5"
            onClick={() => setOpenId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-lg"
            >
              <div className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setOpenId(null)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${open.accent_color}1a`, color: open.accent_color }}
              >
                <Gift className="h-6 w-6" />
              </div>
              <h2 className="mt-3 font-display text-xl font-semibold">{open.label}</h2>
              <p className="text-sm text-muted-foreground">{open.business?.name ?? "Business"}</p>

              <div className="mt-5 flex justify-center">
                <QrDisplay value={`stempel:voucher:${open.id}`} size={220} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Show this code to the business — they scan it to redeem your reward.
              </p>

              <div className="mt-5 space-y-2 text-left text-xs text-muted-foreground">
                {addressOf(open.business) && (
                  <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{addressOf(open.business)}</div>
                )}
                {open.business?.phone && (
                  <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{open.business.phone}</div>
                )}
                {open.business?.website && (
                  <div className="flex items-center gap-2 truncate"><Globe className="h-3.5 w-3.5 shrink-0" />{open.business.website}</div>
                )}
                <div className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0" />Unlocked at step {open.step_number} • {fmt(open.created_at)}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {redeemed && (
          <motion.div
            key={`redeemed-${redeemed.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-6 backdrop-blur-md"
            onClick={() => setRedeemed(null)}
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
                style={{ background: redeemed.accent_color }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 16, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center"
              role="status"
              aria-live="polite"
            >
              <button
                onClick={() => setRedeemed(null)}
                className="absolute right-3 top-3 p-2 opacity-60 hover:opacity-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <OrnamentDivider className="mx-auto w-40 opacity-70" />

              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 260, delay: 0.15 }}
                className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${redeemed.accent_color}1a`, color: redeemed.accent_color }}
              >
                <Check className="h-8 w-8" strokeWidth={3} />
              </motion.div>

              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Enjoy your reward
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold">{redeemed.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {redeemed.business?.name ?? "Business"} · {redeemed.card_title}
              </p>

              <p className="mt-5 text-xs text-muted-foreground">
                Redeemed just now — it's moved to your used vouchers.
              </p>

              <OrnamentDivider className="mx-auto mt-6 w-40 opacity-70" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
