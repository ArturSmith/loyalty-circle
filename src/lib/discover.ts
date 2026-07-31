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

/** Asks the browser for the user's location (cached for 24h). Never throws. */
export function useUserLocation(enabled = true) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [asked, setAsked] = useState(false);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAsked(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeCachedCoords(next);
        setCoords(next);
        setAsked(true);
      },
      () => setAsked(true),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cachedCoords = readCachedCoords();
    if (cachedCoords) {
      setCoords(cachedCoords);
      setAsked(true);
      return;
    }
    request();
  }, [enabled, request]);

  return { coords, asked, request };
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
