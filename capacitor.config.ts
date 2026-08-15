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
