import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Native shell wiring: status bar style, splash hide, Android hardware back
 * button mapped to browser history, and deep links. No-ops on the web.
 */
export async function initNative(
  onBack: () => boolean,
  onDeepLink?: (path: string) => void,
) {
  if (!Capacitor.isNativePlatform()) return () => {};

  const cleanups: Array<() => void> = [];

  // Lets CSS opt into native-only tweaks (safe areas, no tap highlight, …).
  document.documentElement.classList.add("capacitor-native");
  document.documentElement.dataset.capacitorPlatform = Capacitor.getPlatform();
  cleanups.push(() => document.documentElement.classList.remove("capacitor-native"));

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {}

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}

  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", () => {
      // onBack returns true when the app handled navigation itself.
      if (!onBack()) App.exitApp();
    });
    cleanups.push(() => listener.remove());

    // Deep links (e.g. scanning https://clubcarder.com/b/<id> opens the app).
    if (onDeepLink) {
      const urlListener = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const parsed = new URL(url);
          onDeepLink(`${parsed.pathname}${parsed.search}${parsed.hash}`);
        } catch {}
      });
      cleanups.push(() => urlListener.remove());
    }
  } catch {}

  return () => cleanups.forEach((fn) => fn());
}

export async function hapticTap() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}
