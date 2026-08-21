/**
 * Tiny in-memory store for bottom-nav tab data so switching tabs renders the
 * previous content instantly instead of showing a loading state again.
 * Cleared on sign-out so one user's data never shows up for the next.
 */
const store = new Map<string, unknown>();

export function getTabCache<T>(key: string): T | null {
  return (store.has(key) ? (store.get(key) as T) : null);
}

export function setTabCache<T>(key: string, value: T) {
  store.set(key, value);
}

export function clearTabCaches() {
  store.clear();
}
