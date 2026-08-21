import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createWalletPass } from "@/utils/wallet.functions";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Spinner } from "@/components/Spinner";

export function GoogleWalletButton({ templateId, className }: { templateId: string; className?: string }) {
  const create = useServerFn(createWalletPass);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const { saveUrl } = await create({ data: { templateId } });
      window.location.href = saveUrl;
    } catch (error) {
      toast.error("Couldn't create the wallet pass", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Add this loyalty card to Google Wallet"
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-opacity disabled:opacity-60 ${className ?? ""}`}
    >
      {busy ? <Spinner size={16} label={null} /> : <Wallet className="h-4 w-4" />}
      {busy ? "Preparing pass…" : "Add to Google Wallet"}
    </button>
  );
}
