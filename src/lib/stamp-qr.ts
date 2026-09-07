import { PUBLIC_SITE_URL } from "@/lib/walletFormat";

/**
 * One-time stamping codes shown by a business for a single card.
 *
 * The payload is a normal https URL rather than a `stempel:` scheme so a plain
 * phone camera can open it. The in-app scanner recognises the same shape and
 * routes internally instead of bouncing through the browser.
 */
export const STAMP_QR_PATH = "/stamp/";

export function stampQrValue(token: string) {
  return `${PUBLIC_SITE_URL}${STAMP_QR_PATH}${token}`;
}

/** Pull the token out of a scanned URL, or null when it isn't a stamping QR. */
export function parseStampQrToken(text: string): string | null {
  const match = text
    .trim()
    .match(/(?:^|\/)stamp\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}
