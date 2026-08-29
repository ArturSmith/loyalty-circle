/**
 * Tiny in-memory store for bottom-nav tab data so switching tabs renders the
 * previous content instantly instead of showing a loading state again.
 * Cleared on sign-out so one user's data never shows up for the next.
 */
const store = new Map<string, unknown>();

export function getTabCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  return (store.has(key) ? (store.get(key) as T) : null);
}

export function setTabCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  store.set(key, value);
}

/** Clears one tab after a mutation so it cannot briefly restore stale data. */
export function invalidateTabCache(key: string) {
  if (typeof window === "undefined") return;
  store.delete(key);
}

export function clearTabCaches() {
  if (typeof window === "undefined") return;
  store.clear();
}
