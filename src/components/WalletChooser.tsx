import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createWalletPass } from "@/utils/wallet.functions";
import { toast } from "sonner";
import { Apple, Smartphone, Wallet } from "lucide-react";
import { Spinner } from "@/components/Spinner";

type Props = {
  templateId: string;
  cardTitle: string;
  /** Shown only when Google Wallet is configured server-side. */
  googleReady: boolean;
  /** Shown only when Apple Wallet passes can actually be generated. */
  appleReady: boolean;
  acceptedTermsVersion: number | null;
  /** Reveals the terms instead of leaving an apparently broken disabled button. */
  onTermsRequired: () => void;
  /** Sends the visitor to sign-in so the card lands in the in-app wallet. */
  onUseInAppWallet: () => void;
  className?: string;
};

/**
 * The choice we give a signed-out visitor after they scan a business QR.
 *
 * Google Wallet and Apple Wallet need no account at all — the pass is created
 * anonymously and tied to a claim secret, so it can be linked to a real account
 * later. The in-app wallet is the only option that requires registering, and it
 * is presented last and labelled honestly.
 */
export function WalletChooser({
  templateId,
  cardTitle,
  googleReady,
  appleReady,
  acceptedTermsVersion,
  onTermsRequired,
  onUseInAppWallet,
  className,
}: Props) {
  const create = useServerFn(createWalletPass);
  const [busy, setBusy] = useState(false);

  const addToGoogle = async () => {
    if (acceptedTermsVersion == null) {
      onTermsRequired();
      return;
    }
    setBusy(true);
    try {
      const { saveUrl } = await create({ data: { templateId, acceptedTermsVersion } });
      window.location.href = saveUrl;
    } catch (error) {
      toast.error("Couldn't create the wallet pass", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setBusy(false);
    }
  };

  const anyNativeWallet = googleReady || appleReady;

  return (
    <div className={`mt-3 space-y-2 ${className ?? ""}`}>
      {appleReady ? (
        <button
          type="button"
          onClick={() => {
            if (acceptedTermsVersion == null) onTermsRequired();
            else toast.info("Apple Wallet is coming soon");
          }}
          disabled={busy}
          aria-label={`Add ${cardTitle} to Apple Wallet`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-60"
        >
          <Apple className="h-4 w-4" />
          Add to Apple Wallet
        </button>
      ) : null}

      {googleReady ? (
        <button
          type="button"
          onClick={addToGoogle}
          disabled={busy}
          aria-label={`Add ${cardTitle} to Google Wallet`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-60"
        >
          {busy ? <Spinner size={16} label={null} /> : <Wallet className="h-4 w-4" />}
          {busy ? "Preparing pass…" : "Add to Google Wallet"}
        </button>
      ) : null}

      {anyNativeWallet ? (
        <p className="text-center text-[11px] text-muted-foreground">
          No account needed — the pass goes straight to your phone.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (acceptedTermsVersion == null) onTermsRequired();
          else onUseInAppWallet();
        }}
        disabled={busy}
        aria-label={`Add ${cardTitle} to the ClubCarder wallet`}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-opacity disabled:opacity-60 ${
          anyNativeWallet
            ? "border border-border bg-transparent text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <Smartphone className="h-4 w-4" />
        Add to ClubCarder wallet
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        Requires a free account. Keeps every card in one place.
      </p>
    </div>
  );
}
