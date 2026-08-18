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

// The web bundle updates the instant we deploy; the APK/IPA only updates when
// someone installs a new build. So there is always a window where a device runs
// new JavaScript against an older binary that has never heard of this plugin,
// and every call throws "not implemented". Auth storage sits on the critical
// path, so a throw here white-screens the whole app. Fall back to localStorage
// instead: less durable, but the user stays signed in and the app starts, and
// the next install silently upgrades them.
let pluginUsable: boolean | undefined;

async function canUsePlugin(): Promise<boolean> {
  if (pluginUsable !== undefined) return pluginUsable;
  if (!Capacitor.isPluginAvailable("Preferences")) return (pluginUsable = false);
  try {
    // Availability only tells us the plugin is registered in JS. Actually
    // touching it is the only way to know the native half shipped too.
    await Preferences.get({ key: "__probe" });
    pluginUsable = true;
  } catch {
    pluginUsable = false;
  }
  return pluginUsable;
}

const local = {
  get: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  set: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  remove: (key: string) => globalThis.localStorage?.removeItem(key),
};

const nativeStorage: SupabaseAuthStorage = {
  async getItem(key) {
    if (!(await canUsePlugin())) return local.get(key);
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) return value;

      // First launch after upgrading from a localStorage build: adopt the
      // session that's already there instead of bouncing the user to login.
      const legacy = local.get(key);
      if (legacy !== null) await Preferences.set({ key, value: legacy });
      return legacy;
    } catch {
      pluginUsable = false;
      return local.get(key);
    }
  },
  async setItem(key, value) {
    // Mirror into localStorage too. It costs nothing, and it means a rollback to
    // an older build still finds the session instead of logging the user out.
    local.set(key, value);
    if (!(await canUsePlugin())) return;
    try {
      await Preferences.set({ key, value });
    } catch {
      pluginUsable = false;
    }
  },
  async removeItem(key) {
    local.remove(key);
    if (!(await canUsePlugin())) return;
    try {
      await Preferences.remove({ key });
    } catch {
      pluginUsable = false;
    }
  },
};

export function getAuthStorage(): SupabaseAuthStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return Capacitor.isNativePlatform() ? nativeStorage : window.localStorage;
}
