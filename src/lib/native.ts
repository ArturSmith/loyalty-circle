import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Native shell wiring: status bar style, splash hide, and Android hardware
 * back button mapped to browser history. No-ops on the web.
 */
export async function initNative(onBack: () => boolean) {
  if (!Capacitor.isNativePlatform()) return () => {};

  const cleanups: Array<() => void> = [];

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
