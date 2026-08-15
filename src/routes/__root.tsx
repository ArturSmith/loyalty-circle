import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      if (event === "SIGNED_IN") {
        (async () => {
          try {
            let dest: string | null = null;
            try {
              const stashed = sessionStorage.getItem("post_auth_redirect");
              if (stashed && stashed.startsWith("/")) {
                sessionStorage.removeItem("post_auth_redirect");
                dest = stashed;
              }
            } catch {}
            const path = window.location.pathname;
            if (!dest && (path === "/" || path === "/auth")) {
              const { getDefaultHome } = await import("@/lib/defaultHome");
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
      initNative(() => {
        if (window.history.length > 1) {
          window.history.back();
          return true;
        }
        return false;
      }).then((fn) => { dispose = fn; }),
    );
    return () => dispose?.();
  }, []);




  return (
    <QueryClientProvider client={queryClient}>
      <PaymentTestModeBanner />
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
