import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";

/**
 * Pause and delete, for the owner only.
 *
 * Both actions go through security-definer RPCs that re-check ownership in the
 * database. The buttons here are hidden for invited administrators, but that
 * is only a courtesy — the check that matters is server-side, since anyone can
 * call the API directly.
 */
export function BusinessLifecycle({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const navigate = useNavigate();
  const [isOwner, setIsOwner] = useState(false);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      // Cast pending a Supabase type regeneration: paused_at is new.
      const { data } = await (supabase as any)
        .from("businesses")
        .select("owner_id, paused_at")
        .eq("id", businessId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as { owner_id: string; paused_at?: string | null };
      setIsOwner(!!u.user && row.owner_id === u.user.id);
      setPaused(!!row.paused_at);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!isOwner || paused === null) return null;

  const togglePause = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("set_business_paused", {
      _business_id: businessId,
      _paused: !paused,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPaused(!paused);
    toast.success(
      paused ? "Your business is live again" : "Your business is paused",
    );
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("delete_business", {
      _business_id: businessId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business deleted");
    navigate({ to: "/wallet", replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">{paused ? "Paused" : "Active"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {paused
            ? "You're hidden from Discover and your public page is closed. Cards already in customers' wallets are untouched."
            : "Pausing hides you from Discover and stops new customers signing up. Existing cards keep working."}
        </p>
        <Button
          variant="outline"
          className="mt-3 w-full gap-2"
          disabled={busy}
          onClick={togglePause}
        >
          {paused ? (
            <>
              <PlayCircle className="h-4 w-4" /> Resume business
            </>
          ) : (
            <>
              <PauseCircle className="h-4 w-4" /> Pause business
            </>
          )}
        </Button>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm font-medium text-destructive">Delete this business</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This removes your cards, locations, staff and every stamp your
          customers have collected. It cannot be undone.
        </p>

        {confirming ? (
          <div className="mt-3">
            {/* Typing the name is the only thing standing between a stray tap
                and every customer losing their stamps. */}
            <Label htmlFor="confirm-name" className="text-xs">
              Type <span className="font-semibold">{businessName}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mt-1.5"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setConfirming(false);
                  setConfirmName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busy || confirmName.trim() !== businessName.trim()}
                onClick={remove}
              >
                {busy ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="mt-3 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-4 w-4" /> Delete business
          </Button>
        )}
      </div>
    </div>
  );
}
