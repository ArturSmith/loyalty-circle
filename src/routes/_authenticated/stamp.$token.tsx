import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Gift, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { ScreenLoader } from "@/components/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { hapticTap } from "@/lib/native";
import { getPaddleEnvironment } from "@/lib/paddle";
import { syncWalletPass } from "@/utils/wallet.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/stamp/$token")({
  head: () => ({ meta: [{ title: "Collect stamp — ClubCarder" }] }),
  component: StampRedeemPage,
});

type Outcome =
  | {
      kind: "stamped";
      stampsCount: number;
      totalSteps: number;
      cardTitle: string;
      businessName: string;
      reward: { label: string } | null;
    }
  | { kind: "no_card"; businessId: string; cardTitle: string; businessName: string }
  | { kind: "error"; title: string; message: string };

function describeFailure(status: string): Outcome {
  switch (status) {
    case "already_used":
      return {
        kind: "error",
        title: "Code already used",
        message: "Someone has already collected this stamp. Ask the business to show a new code.",
      };
    case "expired":
      return {
        kind: "error",
        title: "Code expired",
        message: "This code timed out. Ask the business to generate a fresh one.",
      };
    case "card_full":
      return {
        kind: "error",
        title: "Card is complete",
        message:
          "This card is already full. Redeem your reward from Vouchers — a new card starts after that.",
      };
    default:
      return {
        kind: "error",
        title: "Not a valid code",
        message: "This QR isn't a ClubCarder stamping code, or it has been replaced.",
      };
  }
}

function describeError(message: string): Outcome {
  if (message.includes("subscription required")) {
    return {
      kind: "error",
      title: "Stamping paused",
      message: "This business's ClubCarder subscription is inactive, so stamps are paused.",
    };
  }
  if (message.includes("card is full")) {
    return describeFailure("card_full");
  }
  return {
    kind: "error",
    title: "Something went wrong",
    message: "The stamp couldn't be added. Check your connection and try scanning again.",
  };
}

function StampRedeemPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const syncPass = useServerFn(syncWalletPass);
  // React runs effects twice in development. Redeeming is destructive to the
  // token, so the second run must never fire and report "already used".
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (attempted.current === token) return;
    attempted.current = token;

    void (async () => {
      try {
        const { data, error } = await supabase.rpc("redeem_card_stamp_qr_token", {
          _token: token,
          _env: getPaddleEnvironment(),
        });
        if (error) {
          setOutcome(describeError(error.message));
          return;
        }
        const result = data as unknown as {
          status: string;
          stamps_count?: number;
          total_steps?: number;
          card_title?: string;
          business_name?: string;
          business_id?: string;
          instance_id?: string;
          reward?: { label?: string } | null;
        };

        if (result.status === "stamped") {
          void hapticTap();
          setOutcome({
            kind: "stamped",
            stampsCount: result.stamps_count ?? 0,
            totalSteps: result.total_steps ?? 0,
            cardTitle: result.card_title ?? "Card",
            businessName: result.business_name ?? "",
            reward: result.reward?.label ? { label: result.reward.label } : null,
          });
          // Best effort: a phone-wallet pass lagging behind is a nuisance, not
          // a lost stamp, so this must not block the confirmation screen.
          if (result.instance_id) {
            void syncPass({
              data: { instanceId: result.instance_id, environment: getPaddleEnvironment() },
            }).catch((reason) => console.error("wallet pass sync failed", reason));
          }
          return;
        }

        if (result.status === "no_card" && result.business_id) {
          setOutcome({
            kind: "no_card",
            businessId: result.business_id,
            cardTitle: result.card_title ?? "this card",
            businessName: result.business_name ?? "the business",
          });
          return;
        }

        setOutcome(describeFailure(result.status));
      } catch (reason) {
        setOutcome(describeError(reason instanceof Error ? reason.message : ""));
      }
    })();
  }, [token, syncPass]);

  if (!outcome) return <ScreenLoader />;

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-card paper-grain card-shadow p-8 text-center"
      >
        {outcome.kind === "stamped" ? (
          <>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 11, stiffness: 200 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
            >
              <CheckCircle2 className="h-9 w-9" />
            </motion.div>
            <h1 className="mt-4 font-display text-3xl">Stamp collected</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {outcome.cardTitle}
              {outcome.businessName ? ` • ${outcome.businessName}` : ""}
            </p>
            <p className="mt-3 font-display text-2xl">
              {outcome.stampsCount}
              <span className="text-base text-muted-foreground">/{outcome.totalSteps}</span>
            </p>
            {outcome.reward && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/20 px-4 py-2 text-sm font-semibold text-ink">
                <Gift className="h-4 w-4" /> Reward unlocked: {outcome.reward.label}
              </div>
            )}
            <OrnamentDivider className="mx-auto mt-6 w-40 opacity-70" />
            <Button className="mt-6 h-11 w-full" onClick={() => navigate({ to: "/wallet" })}>
              Back to wallet
            </Button>
          </>
        ) : outcome.kind === "no_card" ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Wallet className="h-9 w-9" />
            </div>
            <h1 className="mt-4 font-display text-3xl">Card not in your wallet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Add {outcome.cardTitle} from {outcome.businessName} first, then scan the code again.
            </p>
            <Link
              to="/b/$businessId"
              params={{ businessId: outcome.businessId }}
              className="mt-6 block"
            >
              <Button className="h-11 w-full">Get the card</Button>
            </Link>
            <Button
              variant="ghost"
              className="mt-2 h-11 w-full"
              onClick={() => navigate({ to: "/wallet" })}
            >
              Back to wallet
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-9 w-9" />
            </div>
            <h1 className="mt-4 font-display text-3xl">{outcome.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{outcome.message}</p>
            <Button
              className="mt-6 h-11 w-full"
              onClick={() => navigate({ to: "/wallet" })}
            >
              Back to wallet
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
