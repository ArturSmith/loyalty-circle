import { isNativeApp } from "@/lib/native";

/**
 * Hands a Google Wallet "save" URL to whatever can actually complete it.
 *
 * On the web this is an ordinary navigation to pay.google.com.
 *
 * Inside the native shell it deliberately is not. `capacitor.config.ts`
 * allow-lists `*.google.com` so the OAuth hops stay in the WebView, and
 * pay.google.com matches that pattern — meaning a plain navigation would load
 * the save page *inside our app*, where it cannot hand off to the Google Wallet
 * app and where the user ends up stranded outside our own navigation. Opening
 * it through the system browser instead gives Android a Custom Tab that can
 * fire the Wallet intent, and leaves our app untouched behind it.
 */
export async function openWalletSaveUrl(saveUrl: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.href = saveUrl;
    return;
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: saveUrl });
  } catch {
    // Plugin missing or the platform refused to open a browser. A same-window
    // navigation is degraded but still lets the user save the pass manually.
    window.location.href = saveUrl;
  }
}
