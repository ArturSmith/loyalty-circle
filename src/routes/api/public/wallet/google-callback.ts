import { createFileRoute } from "@tanstack/react-router";
import {
  instanceIdFromGoogleObjectId,
  recordWalletPassEvent,
} from "@/lib/walletEvents.server";

/**
 * Google Wallet save/delete callback.
 *
 * Configure this URL in the Google Pay & Wallet Console under the issuer's
 * "Callback URL" setting:
 *
 *   https://clubcarder.com/api/public/wallet/google-callback?key=<secret>
 *
 * Google POSTs an ECv2-signed envelope:
 *   { protocolVersion, signature, intermediateSigningKey, signedMessage }
 * where `signedMessage` is a JSON *string* containing classId, objectId,
 * eventType ("save" | "del"), expTimeMillis and nonce.
 *
 * Verifying the ECv2 signature requires fetching and pinning Google's rotating
 * root signing keys. Rather than half-implement that, this endpoint is guarded
 * by a shared secret in the query string (the callback URL is configured once,
 * server-to-server, so the secret never reaches a browser). If you later need
 * full cryptographic verification, that belongs here.
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

type SignedMessage = {
  classId?: string;
  objectId?: string;
  eventType?: string;
  expTimeMillis?: number | string;
  nonce?: string;
};

async function handle(request: Request): Promise<Response> {
  const secret = process.env["GOOGLE_WALLET_CALLBACK_SECRET"];
  if (secret) {
    const provided = new URL(request.url).searchParams.get("key");
    if (provided !== secret) return unauthorized();
  } else {
    // Fail closed: without a configured secret anyone could forge events and
    // poison a business's analytics.
    console.error("GOOGLE_WALLET_CALLBACK_SECRET is not set — rejecting callback");
    return unauthorized();
  }

  let envelope: { signedMessage?: string } | null = null;
  try {
    envelope = (await request.json()) as { signedMessage?: string };
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  let message: SignedMessage;
  try {
    message =
      typeof envelope?.signedMessage === "string"
        ? (JSON.parse(envelope.signedMessage) as SignedMessage)
        : ((envelope ?? {}) as SignedMessage);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const objectId = message.objectId;
  const eventType = (message.eventType ?? "").toLowerCase();
  if (!objectId) return new Response("Bad request", { status: 400 });

  const event = eventType === "save" ? "saved" : eventType === "del" ? "deleted" : null;
  if (!event) {
    console.log("Unhandled Google Wallet eventType:", message.eventType);
    // Acknowledge so Google does not retry an event we simply don't track.
    return Response.json({ received: true });
  }

  const cardInstanceId = instanceIdFromGoogleObjectId(objectId);
  if (!cardInstanceId) {
    console.error("Could not map Google Wallet objectId to a card instance", objectId);
    return Response.json({ received: true });
  }

  await recordWalletPassEvent({
    cardInstanceId,
    platform: "google",
    event,
    objectId,
  });

  return Response.json({ received: true });
}

export const Route = createFileRoute("/api/public/wallet/google-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (error) {
          console.error("Google Wallet callback error:", error);
          return new Response("Callback error", { status: 500 });
        }
      },
    },
  },
});
