/**
 * Small stale-while-revalidate cache for route screen models.
 *
 * TanStack Router restores URL/scroll state, but route components still unmount
 * when navigating away. Screens that fetch in an effect would therefore show a
 * full-page loader every time Back remounted them. This cache lets those screens
 * synchronously restore their last successful model and refresh it quietly.
 * It is deliberately memory-only so account data never survives an app restart.
 */
type CacheEntry = {
  value: unknown;
  updatedAt: number;
  lastReadAt: number;
};

const entries = new Map<string, CacheEntry>();
const MAX_ENTRIES = 60;
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

export type NavigationCacheHit<T> = {
  value: T;
  stale: boolean;
};

export function getNavigationCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): NavigationCacheHit<T> | null {
  // The SSR worker is shared by many requests. Never put authenticated screen
  // models in that process-wide memory; this cache is client-session only.
  if (typeof window === "undefined") return null;
  const entry = entries.get(key);
  if (!entry) return null;
  entry.lastReadAt = Date.now();
  return {
    value: entry.value as T,
    stale: Date.now() - entry.updatedAt > maxAgeMs,
  };
}

export function setNavigationCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  entries.set(key, { value, updatedAt: now, lastReadAt: now });
  if (entries.size <= MAX_ENTRIES) return;
  const oldest = [...entries.entries()].sort((a, b) => a[1].lastReadAt - b[1].lastReadAt)[0]?.[0];
  if (oldest) entries.delete(oldest);
}

export function invalidateNavigationCache(prefix?: string) {
  if (typeof window === "undefined") return;
  if (!prefix) {
    entries.clear();
    return;
  }
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
