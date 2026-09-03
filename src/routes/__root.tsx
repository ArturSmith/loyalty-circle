import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { BottomNav, isTabRoute, isCustomerAppRoute } from "@/components/BottomNav";
import { BusinessDesktopNavigation } from "@/components/business/BusinessDesktopNavigation";
import { clearTabCaches } from "@/lib/tabCache";
import { PullToRefresh } from "@/components/PullToRefresh";
import { LanguageProvider } from "@/i18n";
import { invalidateNavigationCache } from "@/lib/navigationCache";
import { getDefaultHome, isAuthEntryPath } from "@/lib/defaultHome";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">This card doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "ClubCarder — Digital loyalty cards for local businesses" },
      { name: "description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
      { name: "theme-color", content: "#fafbfc" },
      { property: "og:title", content: "ClubCarder — Digital loyalty cards for local businesses" },
      { property: "og:description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ClubCarder — Digital loyalty cards for local businesses" },
      { name: "twitter:description", content: "Beautiful digital stamp cards to replace paper punch cards. For cafés, salons, bakeries, and shops." },
      { property: "og:image", content: "https://clubcarder.com/og-image.png" },
      { name: "twitter:image", content: "https://clubcarder.com/og-image.png" },
      { name: "google-site-verification", content: "dpZKGJdqkJtPq4B2JNyOdjl3adDrK1_iEunPoHK8kXM" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "icon", href: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { rel: "icon", href: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const appLocation = useRouterState({ select: (state) => state.location });
  const isBusinessScreen = appLocation.pathname === "/business" || appLocation.pathname.startsWith("/business/") ||
    (appLocation.pathname.startsWith("/chats/") && (appLocation.search as { scope?: string }).scope === "business");
  const hasDesktopNavigation = isBusinessScreen || isCustomerAppRoute(appLocation.pathname);
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [refreshVersion, setRefreshVersion] = useState(0);

  const refreshApp = useCallback(async () => {
    // Most screens load directly from Supabase in mount effects, while a few
    // use React Query or the tab cache. Refresh all three data paths together.
    clearTabCaches();
    invalidateNavigationCache();
    await Promise.all([queryClient.invalidateQueries(), router.invalidate()]);
    setRefreshVersion((version) => version + 1);
  }, [queryClient, router]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event === "SIGNED_OUT") {
        clearTabCaches();
        invalidateNavigationCache();
      }
      else queryClient.invalidateQueries();
      if (event === "SIGNED_IN") {
        (async () => {
          try {
            let dest: string | null = null;
            const path = window.location.pathname;
            // A delayed SIGNED_IN event (for example after refreshing a token)
            // can arrive while the user is already navigating the app. Never
            // let an old post-auth destination hijack Workspace or any other
            // authenticated screen.
            if (!isAuthEntryPath(path)) return;
            try {
              const stashed = sessionStorage.getItem("post_auth_redirect");
              if (stashed && stashed.startsWith("/")) {
                sessionStorage.removeItem("post_auth_redirect");
                dest = stashed;
              }
            } catch {}
            if (!dest) {
              dest = await getDefaultHome();
            }
            if (dest && window.location.pathname !== dest) {
              router.navigate({ to: dest });
            }
          } catch {}
        })();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    import("@/lib/native").then(({ initNative }) =>
      initNative(
        () => {
          if (window.history.length > 1) {
            window.history.back();
            return true;
          }
          return false;
        },
        (path) => {
          if (path && path !== window.location.pathname + window.location.search) {
            router.navigate({ to: path });
          }
        },
      ).then((fn) => { dispose = fn; }),
    );
    return () => dispose?.();
  }, [router]);




  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        {/* Shared bottom safe-area padding on mobile. In the native shell this
            is also the scroll container; on web the document scrolls as usual. */}
        <div id="app-scroll" className={hasDesktopNavigation ? "responsive-app-shell" : undefined}>
          <PaymentTestModeBanner />
          <Outlet key={refreshVersion} />
        </div>
        <PullToRefresh onRefresh={refreshApp} />
        <PersistentBottomNav />
        {isBusinessScreen && <BusinessDesktopNavigation businessId={(appLocation.search as { businessId?: string }).businessId} />}
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </LanguageProvider>
  );
}

/**
 * The bottom nav lives here, above the router Outlet, so it is mounted once for
 * the whole session. Rendering it inside each tab screen made it unmount and
 * remount on every tab switch, which re-ran the badge queries and let the bar
 * repaint mid-navigation — the visible "jump" when moving between tabs.
 */
function PersistentBottomNav() {
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  if (pathname.startsWith("/chats/") && (search as { scope?: string }).scope === "business") return null;
  if (!isCustomerAppRoute(pathname)) return null;
  return <BottomNav desktopOnly={!isTabRoute(pathname)} />;
}
