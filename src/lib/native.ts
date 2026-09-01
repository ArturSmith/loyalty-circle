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

const DEFAULT_STATUS_BAR_COLOR = "#fafbfc";

/**
 * Keeps the browser/PWA theme and the native system status bar aligned with a
 * screen-specific palette. Android 15+ takes its bar background from the page
 * behind the transparent system bar, but still honors the icon style; older
 * Android versions also honor setBackgroundColor.
 */
export async function setAppStatusBarTheme(
  backgroundColor: string | null,
  darkBackground: boolean,
) {
  const color = backgroundColor ?? DEFAULT_STATUS_BAR_COLOR;

  if (typeof document !== "undefined") {
    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.appendChild(themeColor);
    }
    themeColor.content = color;
  }

  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Capacitor's enum names describe the theme, while its documentation
    // defines DARK as light content and LIGHT as dark content.
    await StatusBar.setStyle({ style: darkBackground ? Style.Dark : Style.Light });
    try {
      await StatusBar.setBackgroundColor({ color });
    } catch {
      // Expected on Android 15+, where the WebView background supplies it.
    }
  } catch {
    // Status-bar customization is optional outside the native shell.
  }
}

export function resetAppStatusBarTheme() {
  return setAppStatusBarTheme(DEFAULT_STATUS_BAR_COLOR, false);
}

type NativeDisplayBridge = {
  setQrBrightness: (enabled: boolean) => void;
};

/**
 * Makes a displayed customer QR easy to scan in the Android shell. The native
 * bridge restores the previous system-controlled brightness when disabled.
 */
export function setUserQrBrightness(enabled: boolean) {
  if (typeof window === "undefined" || Capacitor.getPlatform() !== "android") return;
  const displayBridge = (window as typeof window & {
    ClubCarderNativeDisplay?: NativeDisplayBridge;
  }).ClubCarderNativeDisplay;
  displayBridge?.setQrBrightness(enabled);
}
