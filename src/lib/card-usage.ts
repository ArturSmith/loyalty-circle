import type { Reward } from "@/components/StampCard";

export type CardUsageReward = Reward & { stampsRequired: number };

/** Identify the card facts a generated draft describes, so edits cannot reuse stale copy. */
export function getCardUsageSource(card: {
  title: string;
  subtitle?: string | null;
  total_steps: number;
  rewards?: readonly Reward[] | null;
}): string {
  return JSON.stringify([
    card.title.trim(), card.subtitle?.trim() || "", card.total_steps,
    getCardUsageRewards(card.total_steps, card.rewards),
  ]);
}

/** Calculate actual scans from the start of a card, matching stamp_business_card.
 * Each scan fills one step, then immediately collects consecutive reward steps.
 * A reward on step 1 is not auto-collected by that RPC, so never promise a
 * zero-stamp gift. This describes existing rules; it does not change earning.
 */
export function getCardUsageRewards(
  totalSteps: number,
  rewards: readonly Reward[] | null | undefined,
): CardUsageReward[] {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) return [];
  const steps = Math.min(32, Math.trunc(totalSteps));
  const byStep = new Map<number, Reward>();
  for (const reward of rewards ?? []) {
    if (
      Number.isInteger(reward.step) &&
      reward.step >= 1 &&
      reward.step <= steps &&
      reward.label.trim() &&
      !byStep.has(reward.step)
    ) {
      byStep.set(reward.step, { step: reward.step, label: reward.label.trim() });
    }
  }

  const result: CardUsageReward[] = [];
  let position = 0;
  let stampsRequired = 0;
  while (position < steps) {
    position += 1;
    stampsRequired += 1;
    while (position < steps) {
      const reward = byStep.get(position + 1);
      if (!reward) break;
      position += 1;
      result.push({ ...reward, stampsRequired });
    }
  }
  return result;
}
