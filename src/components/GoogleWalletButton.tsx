import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createWalletPass, createWalletPassForOwnedCard } from "@/utils/wallet.functions";
import { openWalletSaveUrl } from "@/lib/walletSave";
import { toast } from "sonner";
import { Check, Wallet } from "lucide-react";
import { Spinner } from "@/components/Spinner";

/**
 * Two shapes, because there are genuinely two flows:
 *
 * - `template`: a visitor who has not signed in. Creating the pass also mints a
 *   new anonymous card, so accepting the terms is mandatory first.
 * - `instance`: a card the signed-in user already holds. Nothing is created in
 *   our database - the existing card is mirrored into Google Wallet at its
 *   current stamp count - so there are no terms to accept again.
 */
type TemplateProps = {
  mode?: "template";
  templateId: string;
  acceptedTermsVersion: number | null;
  onTermsRequired?: () => void;
  className?: string;
};

type InstanceProps = {
  mode: "instance";
  instanceId: string;
  /** Already mirrored - say so instead of implying a duplicate is coming. */
  alreadyAdded?: boolean;
  className?: string;
};

export function GoogleWalletButton(props: TemplateProps | InstanceProps) {
  const createForTemplate = useServerFn(createWalletPass);
  const createForInstance = useServerFn(createWalletPassForOwnedCard);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const added = props.mode === "instance" && (props.alreadyAdded || done);

  const onClick = async () => {
    if (props.mode !== "instance" && props.acceptedTermsVersion == null) {
      props.onTermsRequired?.();
      return;
    }

    setBusy(true);
    try {
      let saveUrl: string;
      if (props.mode === "instance") {
        ({ saveUrl } = await createForInstance({ data: { instanceId: props.instanceId } }));
        setDone(true);
      } else {
        ({ saveUrl } = await createForTemplate({
          data: {
            templateId: props.templateId,
            acceptedTermsVersion: props.acceptedTermsVersion as number,
          },
        }));
      }
      await openWalletSaveUrl(saveUrl);
    } catch (error) {
      toast.error("Couldn't create the wallet pass", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      // On native the save URL opens in a browser sheet *over* a still-mounted
      // app, so the button has to be released or it stays stuck on "Preparing".
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={
        added ? "Open this pass in Google Wallet again" : "Add this loyalty card to Google Wallet"
      }
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-60 ${props.className ?? ""}`}
    >
      {busy ? (
        <Spinner size={16} label={null} />
      ) : added ? (
        <Check className="h-4 w-4" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      {busy ? "Preparing pass..." : added ? "In Google Wallet" : "Add to Google Wallet"}
    </button>
  );
}
