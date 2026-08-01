export const PUBLIC_SITE_URL = "https://clubcarder.com";

export const WALLET_SAVE_ORIGINS = [PUBLIC_SITE_URL, "https://www.clubcarder.com"];

export function nextRewardLabel(rewards: unknown, stampsCount: number): string | null {
  if (!Array.isArray(rewards)) return null;
  const upcoming = (rewards as Array<{ step?: number; label?: string }>)
    .filter((r) => typeof r?.step === "number" && (r.step as number) > stampsCount && r.label)
    .sort((a, b) => (a.step ?? 0) - (b.step ?? 0))[0];
  if (!upcoming) return null;
  const remaining = (upcoming.step ?? 0) - stampsCount;
  return `${upcoming.label} — ${remaining} stamp${remaining === 1 ? "" : "s"} to go`;
}

export function claimUrlFor(instanceId: string, secret: string): string {
  return `${PUBLIC_SITE_URL}/claim/${instanceId}?s=${secret}`;
}
