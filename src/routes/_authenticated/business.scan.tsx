import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/QrScanner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, CreditCard, Gift, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useServerFn } from "@tanstack/react-start";
import { syncWalletPass } from "@/utils/wallet.functions";
import { z } from "zod";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { initialsFrom, resolveAvatarUrl } from "@/lib/avatar";

export const Route = createFileRoute("/_authenticated/business/scan")({
  head: () => ({ meta: [{ title: "Scan customer — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: ScanPage,
});

type Result = { stamps_count: number; total_steps: number; reward: { step: number; label: string } | null; completed: boolean };
type VoucherResult = { label: string; business_name: string };
type Rejection = { title: string; message: string };
type CustomerCardChoice = {
  instance_id: string;
  template_id: string;
  title: string;
  subtitle: string | null;
  stamps_count: number;
  total_steps: number;
  completed_at: string | null;
  active: boolean;
  accent_color: string;
  created_at: string;
};
type CustomerSelection = {
  customer: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  avatarUrl: string | null;
  cards: CustomerCardChoice[];
};

function messageFrom(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}


function describeError(raw: string): Rejection {
  const msg = (raw || "").toLowerCase();
  if (msg.includes("permission required: cards.stamp")) {
    return {
      title: "Stamping permission required",
      message: "The business owner has not granted this administrator permission to scan and stamp cards.",
    };
  }
  if (msg.includes("not authorized")) {
    return {
      title: "Not yours to scan",
      message: "This card or voucher belongs to a different business.",
    };
  }
  if (msg.includes("card not found")) {
    return { title: "Card not found", message: "This QR doesn't match any active card. Ask the customer to reopen it." };
  }
  if (msg.includes("card is full")) {
    return { title: "Card is full", message: "Every step is stamped. The reward is ready and the card will refresh automatically in the customer's Wallet." };
  }
  if (msg.includes("please wait")) {
    return { title: "Just stamped", message: "This card was stamped a moment ago. Wait a few seconds before stamping again." };
  }
  if (msg.includes("subscription required")) {
    return { title: "Stamping paused", message: "This business isn't covered by an active subscription. Renew to resume stamping." };
  }
  if (msg.includes("auth required")) {
    return { title: "Signed out", message: "Your session expired. Sign in again to keep stamping." };
  }
  if (msg.includes("voucher already used")) {
    return { title: "Already redeemed", message: "This voucher has already been used." };
  }
  if (msg.includes("voucher not found")) {
    return { title: "Voucher not found", message: "This QR doesn't match any voucher. Ask the customer to reopen it." };
  }
  return { title: "Couldn't stamp", message: raw || "Something went wrong. Try scanning again." };
}

function ScanPage() {
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="cards.stamp">
      <ScanPageContent />
    </BusinessPermissionGate>
  );
}

function ScanPageContent() {
  const navigate = useNavigate();
  const { businessId } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [voucher, setVoucher] = useState<VoucherResult | null>(null);
  const [customerSelection, setCustomerSelection] = useState<CustomerSelection | null>(null);
  const [stampingCardId, setStampingCardId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [paused, setPaused] = useState(false);
  const syncPass = useServerFn(syncWalletPass);

  const stampCard = useCallback(async (instanceId: string) => {
    const { data, error } = await supabase.rpc("stamp_business_card", {
      _card_instance_id: instanceId,
      _business_id: businessId,
      _env: getPaddleEnvironment(),
    });
    if (error) throw error;
    setCustomerSelection(null);
    setResult(data as unknown as Result);
    // Push the new stamp count to the customer's phone wallet pass (best effort).
    void syncPass({ data: { instanceId } }).catch(() => {});
  }, [businessId, syncPass]);

  const onScan = useCallback(async (text: string) => {
    if (busy || paused) return;
    const customerMatch = text.match(/^stempel:user:([0-9a-f-]+)$/i);
    const voucherMatch = text.match(/^stempel:voucher:([0-9a-f-]+)$/i);
    const m = text.match(/^stempel:card:([0-9a-f-]+)$/i);
    if (!m && !voucherMatch && !customerMatch) { toast.error("Not a ClubCarder QR"); return; }
    setBusy(true); setPaused(true);
    try {
      if (customerMatch) {
        const { data, error } = await supabase.rpc("resolve_customer_cards_for_business", {
          _business_id: businessId,
          _customer_qr_token: customerMatch[1]!,
        });
        if (error) throw error;
        const resolved = data as unknown as {
          status?: "found" | "not_found" | "no_cards";
          customer?: CustomerSelection["customer"];
          cards?: CustomerCardChoice[];
        };
        if (resolved.status === "not_found") {
          setRejection({
            title: "Customer not found",
            message: "This customer QR is no longer valid. Ask them to reopen My QR in Wallet.",
          });
          return;
        }
        const cards = resolved.cards ?? [];
        if (resolved.status === "no_cards" || cards.length === 0) {
          setRejection({
            title: "No card for this business",
            message: "This customer has not added any of this business's loyalty cards to their wallet.",
          });
          return;
        }
        if (!resolved.customer) {
          throw new Error("Customer details could not be loaded");
        }
        if (cards.length === 1) {
          const card = cards[0]!;
          if (card.completed_at || card.stamps_count >= card.total_steps) {
            setRejection({
              title: "Card is full",
              message: "This customer's card has just completed. Ask them to keep Wallet open while it refreshes automatically.",
            });
            return;
          }
          await stampCard(card.instance_id);
          return;
        }
        setCustomerSelection({
          customer: resolved.customer,
          avatarUrl: await resolveAvatarUrl(resolved.customer.avatar_url),
          cards,
        });
        return;
      }
      if (voucherMatch) {
        const { data, error } = await supabase.rpc("redeem_business_voucher", {
          _voucher_id: voucherMatch[1]!,
          _business_id: businessId,
        });
        if (error) { setRejection(describeError(error.message)); return; }
        const v = data as unknown as { label?: string; business_name?: string };
        setVoucher({ label: v?.label ?? "Reward", business_name: v?.business_name ?? "" });
        return;
      }
      await stampCard(m![1]!);
    } catch (e) {
      setRejection(describeError(messageFrom(e)));
    } finally {
      setBusy(false);
    }
  }, [businessId, busy, paused, stampCard]);

  const chooseCard = async (instanceId: string) => {
    if (busy) return;
    setBusy(true);
    setStampingCardId(instanceId);
    try {
      await stampCard(instanceId);
    } catch (reason) {
      setCustomerSelection(null);
      setRejection(describeError(messageFrom(reason)));
    } finally {
      setBusy(false);
      setStampingCardId(null);
    }
  };

  const reset = () => { setResult(null); setRejection(null); setVoucher(null); setCustomerSelection(null); setPaused(false); };



  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business", search: { businessId } })}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Scan to stamp</p>
          <h1 className="font-display text-2xl font-semibold">Point at customer's QR</h1>
        </div>
      </header>

      <div className="mt-6">
        <QrScanner onScan={onScan} paused={paused} />
      </div>

      {busy && !customerSelection ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing QR…
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Ask the customer to open Wallet and show My QR.
      </p>

      <AnimatePresence>
        {customerSelection && !result && !voucher && !rejection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/85 p-5 pt-[max(1.25rem,var(--safe-top))] pb-[max(1.25rem,var(--safe-bottom))] backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 230 }}
              className="my-auto w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display font-bold text-primary">
                  {customerSelection.avatarUrl ? (
                    <img src={customerSelection.avatarUrl} alt="Customer profile" className="h-full w-full object-cover" />
                  ) : (
                    initialsFrom(customerSelection.customer.display_name, null)
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Choose loyalty card</p>
                  <h2 className="truncate font-display text-xl font-bold">
                    {customerSelection.customer.display_name || "Customer"}
                  </h2>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {customerSelection.cards.map((card) => {
                  const complete = Boolean(card.completed_at) || card.stamps_count >= card.total_steps;
                  return (
                    <button
                      key={card.instance_id}
                      type="button"
                      disabled={complete || busy}
                      onClick={() => void chooseCard(card.instance_id)}
                      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors enabled:hover:bg-muted/40 disabled:opacity-55"
                    >
                      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: card.accent_color }} />
                      <span className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        {stampingCardId === card.instance_id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{card.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {complete ? "Card complete — refreshing" : `${card.stamps_count} of ${card.total_steps} stamps`}
                        </span>
                      </span>
                      {!complete ? <span className="text-xs font-semibold text-primary">Stamp</span> : null}
                    </button>
                  );
                })}
              </div>

              <Button variant="ghost" className="mt-4 w-full rounded-2xl" onClick={reset} disabled={busy}>
                Scan another customer
              </Button>
            </motion.div>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center">
              <OrnamentDivider className="w-40 mx-auto opacity-70" />
              {result.completed ? (
                <>
                  <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                    className="mt-4 mx-auto h-20 w-20 rounded-full bg-gold text-ink flex items-center justify-center">
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Complete!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">The reward is ready and the card will refresh automatically.</p>
                </>
              ) : (
                <>
                  <motion.div initial={{ scale: 3, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="mt-4 mx-auto h-20 w-20 rounded-full bg-ink text-paper flex items-center justify-center stamp-emboss">
                    <Check className="h-8 w-8" />
                  </motion.div>
                  <h2 className="font-display text-3xl mt-4">Stamped</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{result.stamps_count} of {result.total_steps} stamps</p>
                  {result.reward && (
                    <div className="mt-3 rounded-lg bg-gold/20 text-ink px-4 py-2 text-sm font-semibold">
                      Reward unlocked: {result.reward.label}
                    </div>
                  )}
                </>
              )}
              <OrnamentDivider className="w-40 mx-auto opacity-70 mt-6" />
              <Button className="mt-6 w-full h-11" onClick={reset}>Scan next</Button>
            </motion.div>
          </motion.div>
        )}

        {voucher && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center">
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 11, stiffness: 200 }}
                className="mx-auto h-20 w-20 rounded-full bg-gold text-ink flex items-center justify-center">
                <Gift className="h-8 w-8" />
              </motion.div>
              <h2 className="font-display text-3xl mt-4">Voucher redeemed</h2>
              <p className="mt-2 text-sm text-muted-foreground">Hand over: <span className="font-semibold text-foreground">{voucher.label}</span></p>
              <Button className="mt-6 w-full h-11" onClick={reset}>Scan next</Button>
            </motion.div>
          </motion.div>
        )}

        {rejection && !result && !voucher && (

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              className="w-full max-w-sm rounded-3xl bg-paper paper-grain card-shadow p-8 text-center">
              <motion.div initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="mx-auto h-20 w-20 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
                <XCircle className="h-9 w-9" />
              </motion.div>
              <h2 className="font-display text-3xl mt-4">{rejection.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{rejection.message}</p>
              <Button className="mt-6 w-full h-11" onClick={reset}>Scan another card</Button>
              <Button variant="ghost" className="mt-2 w-full h-10" onClick={() => navigate({ to: "/business", search: { businessId } })}>
                Back to dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
