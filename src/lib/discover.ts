import { useCallback, useEffect, useState } from "react";
import { getPublicSupabase } from "@/lib/publicSupabase";

export type DiscoverCard = {
  template_id: string;
  business_id: string;
  business_name: string;
  business_logo_url: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  title: string;
  subtitle: string | null;
  corner_title: string | null;
  description: string | null;
  total_steps: number;
  grid_cols: number | null;
  shape: string;
  bg_color: string;
  accent_color: string;
  text_color: string;
  stamp_icon: string | null;
  logo_url: string | null;
  rewards: unknown;
  created_at: string;
};

export type Coords = { lat: number; lng: number };

/** One place a business can be visited. */
export type DiscoverLocation = {
  id: string;
  name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  distance_km: number | null;
};

export type DiscoverBusiness = {
  business_id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  category: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  card_count: number;
  location_count: number;
  locations: DiscoverLocation[];
};

/** A single line of address, skipping the parts a business left blank. */
export function formatLocationAddress(loc: DiscoverLocation): string {
  return (
    [loc.address_line1, loc.postal_code, loc.city, loc.country].filter(Boolean).join(", ") ||
    "Address not listed"
  );
}

const COORDS_KEY = "cc_user_coords";
const COORDS_TTL_MS = 24 * 60 * 60 * 1000;

function readCachedCoords(): Coords | null {
  try {
    const raw = window.localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; at: number };
    if (!parsed || Date.now() - parsed.at > COORDS_TTL_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function writeCachedCoords(coords: Coords) {
  try {
    window.localStorage.setItem(COORDS_KEY, JSON.stringify({ ...coords, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * How the last location attempt went.
 *
 * `denied` matters: once permission is refused the browser fails every later
 * `getCurrentPosition` immediately and without prompting, so a retry button is
 * useless and we have to say so instead of appearing to do nothing.
 */
export type LocationStatus = "idle" | "pending" | "granted" | "denied" | "unavailable";

/**
 * Reads the real permission state, which `getCurrentPosition` alone can't tell
 * us: dismissing the prompt reports PERMISSION_DENIED identically to a genuine
 * block, but only the latter is permanent. Returns null where unsupported.
 */
async function readPermissionState(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return result.state;
  } catch {
    return null;
  }
}

/** Asks the browser for the user's location (cached for 24h). Never throws. */
export function useUserLocation(enabled = true) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [asked, setAsked] = useState(false);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAsked(true);
      setStatus("unavailable");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeCachedCoords(next);
        setCoords(next);
        setAsked(true);
        setStatus("granted");
      },
      (error) => {
        setAsked(true);
        if (error.code !== error.PERMISSION_DENIED) {
          // Timeout or position-unavailable: worth retrying.
          setStatus("unavailable");
          return;
        }
        // Safari and iOS WKWebView don't implement permissions.query for
        // geolocation, so state comes back null. Only treat the denial as
        // recoverable when the API positively says we're still at "prompt"
        // (a dismissed dialog); otherwise trust the error and say it's blocked.
        void readPermissionState().then((state) => {
          setStatus(state === "prompt" ? "idle" : "denied");
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      setCoords(cachedCoords);
      setAsked(true);
      setStatus("granted");
      return;
    }
    let cancelled = false;
    // Don't fire an unsolicited prompt on load. If permission was already
    // granted the call is silent, so it's safe; otherwise wait for the user to
    // press "Share location" so the request has a gesture behind it.
    void readPermissionState().then((state) => {
      if (cancelled) return;
      if (state === "granted") {
        request();
      } else {
        setAsked(true);
        setStatus(state === "denied" ? "denied" : "idle");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, request]);

  return { coords, asked, status, request };
}

export async function fetchDiscoverCards(params: {
  coords?: Coords | null;
  query?: string;
  limit?: number;
}): Promise<DiscoverCard[]> {
  const { data, error } = await getPublicSupabase().rpc("discover_cards", {
    _lat: params.coords?.lat ?? null,
    _lng: params.coords?.lng ?? null,
    _q: params.query?.trim() ? params.query.trim() : null,
    _limit: params.limit ?? 200,
  } as never);
  if (error) throw error;
  return (data as unknown as DiscoverCard[] | null) ?? [];
}

export async function fetchDiscoverBusinesses(params: {
  coords?: Coords | null;
  query?: string;
  limit?: number;
}): Promise<DiscoverBusiness[]> {
  // Cast until Supabase types are regenerated with the new RPC.
  const { data, error } = await (getPublicSupabase().rpc as any)("discover_businesses", {
    _lat: params.coords?.lat ?? null,
    _lng: params.coords?.lng ?? null,
    _q: params.query?.trim() ? params.query.trim() : null,
    _limit: params.limit ?? 100,
  });
  if (error) throw error;
  return ((data as unknown as DiscoverBusiness[] | null) ?? []).map((b) => ({
    ...b,
    // Postgres hands back jsonb; guard against it arriving as a string.
    locations: Array.isArray(b.locations)
      ? b.locations
      : ((JSON.parse(String(b.locations || "[]")) as DiscoverLocation[]) ?? []),
  }));
}

export function formatDistance(km: number | null): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function groupByCategory(cards: DiscoverCard[]): Array<{ category: string; cards: DiscoverCard[] }> {
  const map = new Map<string, DiscoverCard[]>();
  for (const card of cards) {
    const key = card.category?.trim() || "Other";
    const list = map.get(key);
    if (list) list.push(card);
    else map.set(key, [card]);
  }
  return [...map.entries()]
    .map(([category, list]) => ({ category, cards: list }))
    .sort((a, b) => (a.category === "Other" ? 1 : b.category === "Other" ? -1 : a.category.localeCompare(b.category)));
}
