import { useSyncExternalStore } from "react";

export const DESKTOP_QUERY = "(min-width: 768px)";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(DESKTOP_QUERY).matches;

/** Matches the sidebar breakpoint, with a hydration-safe mobile default. */
export function useDesktopLayout() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
