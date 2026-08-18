import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

type SupabaseAuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

// `localStorage` inside a WebView is only as durable as the WebView's data
// directory: Android reclaims it under storage pressure, "clear cache" wipes it,
// and iOS evicts it after a few days of the app going unused. Native apps aren't
// supposed to forget who you are, so on device we keep the Supabase session in
// Preferences (SharedPreferences / NSUserDefaults), which is backed up and
// survives everything short of an uninstall.
//
// Preferences is async — that's fine, supabase-js awaits every storage call.
const nativeStorage: SupabaseAuthStorage = {
  async getItem(key) {
    const { value } = await Preferences.get({ key });
    if (value !== null) return value;

    // First launch after upgrading from a localStorage build: adopt the session
    // that's already there instead of bouncing the user to the login screen.
    const legacy = globalThis.localStorage?.getItem(key) ?? null;
    if (legacy !== null) await Preferences.set({ key, value: legacy });
    return legacy;
  },
  async setItem(key, value) {
    await Preferences.set({ key, value });
  },
  async removeItem(key) {
    await Preferences.remove({ key });
    globalThis.localStorage?.removeItem(key);
  },
};

export function getAuthStorage(): SupabaseAuthStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return Capacitor.isNativePlatform() ? nativeStorage : window.localStorage;
}
