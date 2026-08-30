/**
 * Customer identification shared by the Wallet/Profile QR and the business lookup.
 *
 * New QR codes encode an opaque per-customer token, matching the existing
 * `stempel:card:` / `stempel:voucher:` scheme so one scanner can keep legacy
 * card/voucher support without exposing the customer's auth id.
 *
 * For typing by hand a 36-character UUID is unusable at a counter, so we also
 * accept a short prefix. That is only safe because lookup is scoped to a single
 * business's own customers: an 8-character prefix has to be unique among the
 * handful of people holding that business's cards, not globally. The server
 * still reports ambiguity rather than guessing.
 */

export const CUSTOMER_QR_PREFIX = "stempel:user:";

/** Shortest prefix we'll search on. Below this, matches are too likely to collide. */
export const MIN_CODE_LENGTH = 6;

/** The QR payload for a customer id. */
export function customerQrValue(userId: string) {
  return `${CUSTOMER_QR_PREFIX}${userId}`;
}

/**
 * Human-facing short code: the first 8 hex characters, grouped for reading
 * aloud and typing. `a1b2c3d4-…` becomes `A1B2-C3D4`.
 */
export function shortCustomerCode(userId: string) {
  const hex = userId.replace(/[^0-9a-f]/gi, "").slice(0, 8).toUpperCase();
  return hex.length === 8 ? `${hex.slice(0, 4)}-${hex.slice(4)}` : hex;
}

/**
 * Normalises anything the business might supply — a scanned QR, a pasted UUID,
 * or a typed short code — into a bare lowercase hex prefix.
 *
 * Returns null when there aren't enough usable characters to search on.
 */
export function parseCustomerQuery(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  // Tolerate the QR payload, a full URL containing it, or the raw id.
  const withoutPrefix = trimmed.toLowerCase().startsWith(CUSTOMER_QR_PREFIX)
    ? trimmed.slice(CUSTOMER_QR_PREFIX.length)
    : trimmed;

  const hex = withoutPrefix.replace(/[^0-9a-f]/gi, "").toLowerCase();
  return hex.length >= MIN_CODE_LENGTH ? hex : null;
}
