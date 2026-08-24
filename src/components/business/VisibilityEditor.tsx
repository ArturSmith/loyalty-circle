import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type MarketplaceStatus = "unpublished" | "published";

const OPTIONS: { key: MarketplaceStatus; title: string; blurb: string }[] = [
  {
    key: "published",
    title: "List us in the marketplace",
    blurb:
      "Your business and its locations appear in Discover. You can turn this off at any time.",
  },
  {
    key: "unpublished",
    title: "Keep us private",
    blurb:
      "Your cards still work over QR codes and direct links — you just won't show up in the public directory.",
  },
];

/**
 * Marketplace visibility, editable after onboarding.
 *
 * The wizard promises "you can turn this off at any time", but until now the
 * choice was write-once: nothing outside step 7 ever updated the column.
 *
 * Saves immediately on selection rather than behind a Save button — a privacy
 * toggle that silently does nothing until you scroll up and submit a different
 * form is exactly the kind of thing people get wrong.
 */
export function VisibilityEditor({ businessId }: { businessId: string }) {
  const [value, setValue] = useState<MarketplaceStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("marketplace_status")
        .eq("id", businessId)
        .maybeSingle();
      if (cancelled) return;
      // 'pending' and 'rejected' are legacy states from a moderation queue that
      // was never built; treat anything that isn't 'published' as private.
      const status = (data as { marketplace_status?: string } | null)?.marketplace_status;
      setValue(status === "published" ? "published" : "unpublished");
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const select = async (next: MarketplaceStatus) => {
    if (next === value || saving) return;
    const previous = value;
    setValue(next); // optimistic: the radio should feel instant
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        marketplace_status: next,
        marketplace_submitted_at: next === "published" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);
    setSaving(false);
    if (error) {
      setValue(previous);
      toast.error(error.message);
      return;
    }
    toast.success(
      next === "published"
        ? "Your business is listed in Discover"
        : "Your business is hidden from Discover",
    );
  };

  if (value === null) {
    return <div className="h-32 animate-pulse rounded-xl bg-muted/40" />;
  }

  return (
    <div className="space-y-3">
      {OPTIONS.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => select(o.key)}
            disabled={saving}
            aria-pressed={selected}
            className={`w-full rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{o.blurb}</span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
