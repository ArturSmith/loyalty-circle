import { scansToNextReward, type RewardStep } from "./rewardProgress";

export const PUBLIC_SITE_URL = "https://clubcarder.com";

export const WALLET_SAVE_ORIGINS = [PUBLIC_SITE_URL, "https://www.clubcarder.com"];

export function nextRewardLabel(
  rewards: unknown,
  stampsCount: number,
  totalSteps: number,
): string | null {
  if (!Array.isArray(rewards)) return null;
  const steps = (rewards as RewardStep[]).filter(
    (r) => typeof r?.step === "number" && r.label,
  );
  // Reward steps are granted rather than scanned, so the remaining count skips
  // them - see scansToNextReward.
  const progress = scansToNextReward(stampsCount, totalSteps, steps);
  if (!progress?.reward?.label) return null;
  const { scans } = progress;
  return `${progress.reward.label} — ${scans} stamp${scans === 1 ? "" : "s"} to go`;
}

export function claimUrlFor(instanceId: string, secret: string): string {
  return `${PUBLIC_SITE_URL}/claim/${instanceId}?s=${secret}`;
}
