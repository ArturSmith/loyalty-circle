import { isNativeApp } from "@/lib/native";

/**
 * A tab reserved now, navigated later.
 *
 * Some destinations (a Paddle portal session, a signed invoice PDF) only exist
 * after a round trip to the server. Calling `window.open` once the URL arrives
 * is too late: the browser no longer sees a user gesture and blocks the popup.
 * So the tab is opened synchronously inside the click handler and pointed at
 * the real URL when it resolves.
 */
export type PendingTab = {
  /** Send the reserved tab to `url`. */
  navigate: (url: string) => void;
  /** The request failed — close the tab rather than leaving it blank. */
  cancel: () => void;
};

/**
 * Reserves a tab. Must be called synchronously from a user gesture.
 *
 * Note the deliberate absence of `noopener` here. `window.open` returns `null`
 * whenever `noopener` is requested — that is the specified behaviour, since the
 * whole point is to deny the opener a handle — so passing it makes the returned
 * reference useless and leaves an orphaned blank tab. The opener relationship
 * is severed immediately afterwards instead, which achieves the same thing
 * while keeping the handle.
 */
export function reserveTab(): PendingTab {
  // In the native shell there are no tabs. Capacitor hands any navigation
  // outside the app's own origin to the system browser, so assigning the
  // location is both sufficient and what users expect from an external link.
  if (isNativeApp()) {
    return {
      navigate: (url) => window.location.assign(url),
      cancel: () => {},
    };
  }

  const win = window.open("about:blank", "_blank");

  if (!win) {
    // Popup blocked despite the gesture, or opened by an extension. Falling
    // back to the current tab is better than the click doing nothing at all.
    return {
      navigate: (url) => window.location.assign(url),
      cancel: () => {},
    };
  }

  // Stop the destination from reaching back through `window.opener` and
  // navigating this tab elsewhere (reverse tabnabbing).
  try {
    win.opener = null;
  } catch {
    // Cross-origin by the time we get here; nothing to sever.
  }

  return {
    navigate: (url) => {
      win.location.href = url;
    },
    cancel: () => win.close(),
  };
}
