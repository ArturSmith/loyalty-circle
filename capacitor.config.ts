import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.clubcarder.app",
  appName: "ClubCarder",
  // This app is server-rendered, so the native shell loads the live site.
  // `capacitor-shell/` only holds an offline fallback page.
  webDir: "capacitor-shell",
  server: {
    url: "https://clubcarder.com",
    cleartext: false,
    androidScheme: "https",
    // Sign-in bounces through the OAuth broker and the identity provider before
    // landing back on our origin with the tokens in the URL fragment. Without
    // these hosts listed, Capacitor treats the first hop off our domain as an
    // external link and hands it to the system browser — the user authenticates
    // in Chrome, Chrome receives the session, and the app stays signed out.
    allowNavigation: [
      "accounts.google.com",
      "*.google.com",
      "appleid.apple.com",
      "login.microsoftonline.com",
      "oauth.lovable.app",
      "lovable.dev",
      "*.supabase.co",
    ],
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#fafbfc",
      showSpinner: false,
    },
  },
};

export default config;
