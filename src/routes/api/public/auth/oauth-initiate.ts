import { createFileRoute } from "@tanstack/react-router";

/**
 * Starts a native OAuth sign-in.
 *
 * The Android app cannot open Supabase's `/auth/v1/authorize` directly: doing
 * so would bake the Supabase project URL into the APK, and the app has no way
 * to keep that in step with the deployment. It opens this endpoint instead and
 * this endpoint redirects on to the provider.
 *
 *   com.clubcarder.app  ->  /api/public/auth/oauth-initiate
 *                       ->  <supabase>/auth/v1/authorize
 *                       ->  Google / Apple
 *                       ->  <supabase>/auth/v1/callback
 *                       ->  com.clubcarder.app://oauth-callback#refresh_token=...
 *
 * The final hop is caught by the intent filter on LoginActivity, which trades
 * the refresh token for a session.
 */

/** Providers the app offers. Anything else is rejected rather than forwarded. */
const ALLOWED_PROVIDERS = new Set(["google", "apple"]);

/**
 * Callback targets we are willing to send a user to.
 *
 * This endpoint takes a redirect target from an untrusted query string, so
 * without an allow-list it would be an open redirector: an attacker could send
 * `?redirect_uri=https://evil.example` and have a genuine clubcarder.com link
 * carry a freshly minted session token off to their own site.
 */
const ALLOWED_REDIRECTS = new Set(["com.clubcarder.app://oauth-callback"]);

function badRequest(message: string) {
  return new Response(message, {
    status: 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function handle(request: Request): Response {
  const params = new URL(request.url).searchParams;

  const provider = params.get("provider") ?? "";
  if (!ALLOWED_PROVIDERS.has(provider)) return badRequest("Unsupported provider.");

  const redirectUri = params.get("redirect_uri") ?? "";
  if (!ALLOWED_REDIRECTS.has(redirectUri)) return badRequest("Unsupported redirect target.");

  const state = params.get("state") ?? "";
  // The app generates the state and checks it again on the way back, so an
  // unsolicited deep link cannot complete a sign-in. Refuse to start a flow
  // that could not be verified rather than starting an unprotected one.
  if (!/^[a-f0-9]{16,128}$/i.test(state)) return badRequest("Missing or malformed state.");

  const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  if (!supabaseUrl) {
    console.error("SUPABASE_URL is not set — cannot start native OAuth");
    return new Response("Sign-in is unavailable.", { status: 500 });
  }

  // Supabase appends the session to `redirect_to` as a URL fragment and leaves
  // the rest of the target alone, so the state rides along in the query string
  // and arrives beside the tokens.
  const callback = `${redirectUri}?state=${encodeURIComponent(state)}`;

  const authorize = new URL("/auth/v1/authorize", supabaseUrl);
  authorize.searchParams.set("provider", provider);
  authorize.searchParams.set("redirect_to", callback);

  // Without this, Google silently reuses the only signed-in account and the
  // "wrong account" case becomes unrecoverable from inside the app.
  const prompt = params.get("prompt");
  if (provider === "google" && prompt === "select_account") {
    authorize.searchParams.set("prompt", "select_account");
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      // A cached redirect would pin every later sign-in to this one state value.
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/public/auth/oauth-initiate")({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          return handle(request);
        } catch (error) {
          console.error("Native OAuth initiate error:", error);
          return new Response("Sign-in is unavailable.", { status: 500 });
        }
      },
    },
  },
});
