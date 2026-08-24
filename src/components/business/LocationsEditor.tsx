import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";
import { useEntitlements } from "@/hooks/useEntitlements";

export type BusinessLocation = {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  is_primary: boolean;
};

const emptyDraft = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  phone: "",
};

type Draft = typeof emptyDraft;

/**
 * Locations CRUD. The plan limit is read from the entitlement registry rather
 * than hardcoded, so changing a plan never means editing this file.
 */
export function LocationsEditor({
  businessId,
  canEdit = true,
  onChanged,
}: {
  businessId: string;
  canEdit?: boolean;
  onChanged?: (count: number) => void;
}) {
  const ent = useEntitlements();
  const [rows, setRows] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("business_locations")
      .select("id,name,address_line1,address_line2,city,region,postal_code,country,phone,is_primary")
      .eq("business_id", businessId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    const list = (data as BusinessLocation[] | null) ?? [];
    setRows(list);
    setLoading(false);
    onChanged?.(list.length);
    // `onChanged` is a render-time callback; excluding it keeps this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const limit = ent.check("locations");
  // The hook's usage count can lag a local insert, so trust whichever is higher.
  const used = Math.max(limit.used, rows.length);
  const atLimit = limit.limit !== null && used >= limit.limit;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const add = async () => {
    if (draft.name.trim().length < 2) {
      toast.error("Give the location a name");
      return;
    }
    if (atLimit) {
      toast.error(limit.reason ?? "You've reached your plan's location limit");
      return;
    }
    setAdding(true);
    const nn = (s: string) => (s.trim() ? s.trim() : null);
    const { error } = await (supabase as any).from("business_locations").insert({
      business_id: businessId,
      name: draft.name.trim(),
      address_line1: nn(draft.address_line1),
      address_line2: nn(draft.address_line2),
      city: nn(draft.city),
      region: nn(draft.region),
      postal_code: nn(draft.postal_code),
      country: nn(draft.country),
      phone: nn(draft.phone),
      is_primary: rows.length === 0,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(emptyDraft);
    await load();
    ent.refetch();
    toast.success("Location added");
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).from("business_locations").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    ent.refetch();
  };

  const makePrimary = async (id: string) => {
    setBusyId(id);
    // Two writes rather than one: there is no partial unique index enforcing a
    // single primary, so clear the flag first to avoid two primaries on failure.
    const { error: clearErr } = await (supabase as any)
      .from("business_locations")
      .update({ is_primary: false })
      .eq("business_id", businessId);
    if (!clearErr) {
      await (supabase as any).from("business_locations").update({ is_primary: true }).eq("id", id);
    }
    setBusyId(null);
    if (clearErr) toast.error(clearErr.message);
    await load();
  };

  if (loading) return <Spinner label="Loading locations…" />;

  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.name}
                  {r.is_primary && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Primary
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.address_line1, r.postal_code, r.city, r.country].filter(Boolean).join(", ") ||
                    "No address yet"}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  {!r.is_primary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Make ${r.name} the primary location`}
                      disabled={busyId === r.id}
                      onClick={() => void makePrimary(r.id)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.name}`}
                    disabled={busyId === r.id}
                    onClick={() => void remove(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit &&
        (atLimit ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {limit.reason ?? "You've reached your plan's location limit."}
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
            <div>
              <Label htmlFor="loc-name">Location name *</Label>
              <Input
                id="loc-name"
                maxLength={100}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Storgata"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="loc-addr">Street address</Label>
              <Input
                id="loc-addr"
                maxLength={200}
                value={draft.address_line1}
                onChange={(e) => set("address_line1", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc-postal">Postal code</Label>
                <Input
                  id="loc-postal"
                  maxLength={20}
                  value={draft.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="loc-city">City</Label>
                <Input
                  id="loc-city"
                  maxLength={100}
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="loc-country">Country</Label>
                <Input
                  id="loc-country"
                  maxLength={100}
                  value={draft.country}
                  onChange={(e) => set("country", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="loc-phone">Phone</Label>
                <Input
                  id="loc-phone"
                  maxLength={30}
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void add()} disabled={adding}>
              {adding ? <Spinner size={16} label={null} className="mr-2" /> : null}
              Add location
            </Button>
            {limit.limit !== null && (
              <p className="text-xs text-muted-foreground">
                {used} of {limit.limit} locations used on {ent.plan.name}.
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
