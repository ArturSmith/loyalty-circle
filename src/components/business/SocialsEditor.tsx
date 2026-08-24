import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, Globe, Instagram, Linkedin, Music2, Twitter, Youtube, Ghost, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";

/**
 * "My Networks" — the social profiles shown on a business' public page.
 *
 * The platform list mirrors the CHECK constraint on `business_socials.platform`;
 * adding one here without the migration will fail on insert.
 */
export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/…" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/…" },
  { key: "tiktok", label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@…" },
  { key: "x", label: "X", icon: Twitter, placeholder: "https://x.com/…" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@…" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/…" },
  { key: "snapchat", label: "Snapchat", icon: Ghost, placeholder: "https://snapchat.com/add/…" },
  { key: "website", label: "Website", icon: Globe, placeholder: "https://…" },
  { key: "other", label: "Other", icon: Link2, placeholder: "https://…" },
] as const;

type PlatformKey = (typeof SOCIAL_PLATFORMS)[number]["key"];

type Row = { id: string; platform: string; url: string };

const emptyValues = () =>
  Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ""])) as Record<PlatformKey, string>;

/** Reject anything that isn't an http(s) URL so the public page can't be used for javascript: links. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function SocialsEditor({
  businessId,
  canEdit = true,
  onSaved,
}: {
  businessId: string;
  canEdit?: boolean;
  onSaved?: () => void;
}) {
  const [values, setValues] = useState<Record<PlatformKey, string>>(emptyValues);
  const [existing, setExisting] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("business_socials")
        .select("id,platform,url")
        .eq("business_id", businessId);
      if (cancelled) return;
      if (error) toast.error(error.message);
      const rows = ((data as Row[] | null) ?? []).filter((r) =>
        SOCIAL_PLATFORMS.some((p) => p.key === r.platform),
      );
      setExisting(rows);
      const next = emptyValues();
      for (const r of rows) next[r.platform as PlatformKey] = r.url;
      setValues(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const save = async () => {
    // Validate everything before touching the database, so a single bad URL
    // can't leave half the links saved.
    const upserts: { business_id: string; platform: string; url: string }[] = [];
    const removals: string[] = [];

    for (const p of SOCIAL_PLATFORMS) {
      const raw = values[p.key];
      const was = existing.find((r) => r.platform === p.key);
      if (!raw.trim()) {
        if (was) removals.push(was.id);
        continue;
      }
      const url = normalizeUrl(raw);
      if (!url) {
        toast.error(`${p.label} doesn't look like a valid link`);
        return;
      }
      upserts.push({ business_id: businessId, platform: p.key, url });
    }

    setSaving(true);
    try {
      if (removals.length) {
        const { error } = await (supabase as any).from("business_socials").delete().in("id", removals);
        if (error) throw error;
      }
      if (upserts.length) {
        const { error } = await (supabase as any)
          .from("business_socials")
          .upsert(upserts, { onConflict: "business_id,platform" });
        if (error) throw error;
      }
      const { data } = await (supabase as any)
        .from("business_socials")
        .select("id,platform,url")
        .eq("business_id", businessId);
      setExisting((data as Row[] | null) ?? []);
      toast.success("Networks saved");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your networks");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading networks…" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key}>
            <Label htmlFor={`social-${key}`} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {label}
            </Label>
            <Input
              id={`social-${key}`}
              inputMode="url"
              maxLength={300}
              disabled={!canEdit}
              value={values[key]}
              placeholder={placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="mt-1.5"
            />
          </div>
        ))}
      </div>
      {canEdit && (
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Spinner size={16} label={null} className="mr-2" /> : null}
          Save networks
        </Button>
      )}
    </div>
  );
}
