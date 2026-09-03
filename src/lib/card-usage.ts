import type { Reward } from "@/components/StampCard";

export type CardUsageReward = Reward & {
  /** Cumulative manual scans; not the number printed on the card. */
  stampsRequired: number;
  /** Numbered circle whose stamp automatically collects this reward. */
  afterStep: number;
};

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

/** Calculate reward milestones, matching stamp_business_card.
 * Each scan fills one step, then immediately collects consecutive reward steps.
 * Keep the triggering circle number separate from cumulative scans: rewards
 * at circles 5 and 10 unlock after numbered steps 4 and 9 (4 and 8 scans).
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
    const afterStep = position;
    while (position < steps) {
      const reward = byStep.get(position + 1);
      if (!reward) break;
      position += 1;
      result.push({ ...reward, stampsRequired, afterStep });
    }
  }
  return result;
}

/** Keep the numeric milestones platform-calculated, including previously saved
 * AI copy. Only recognize the documented sentence format when the complete
 * reward list matches the card, in order; never guess at unrelated prose.
 * Replacing in a single pass also makes repeated reward labels idempotent.
 */
export function normalizeCardUsageInstructions(
  totalSteps: number,
  rewards: readonly Reward[] | null | undefined,
  instructions: string | null | undefined,
): string {
  const text = instructions?.trim() ?? "";
  const milestones = getCardUsageRewards(totalSteps, rewards);
  const pattern = /(After step )(\d+)( you will get voucher for )(‘[^\r\n]*’|“[^\r\n]*”|"[^\r\n]*"|'[^\r\n]*')/g;
  const matches = Array.from(text.matchAll(pattern));
  if (!milestones.length || matches.length !== milestones.length ||
      matches.some((match, index) => match[4].slice(1, -1) !== milestones[index].label)) {
    return text;
  }
  let index = 0;
  return text.replace(pattern, (_match, before, _number, between, quotedLabel) =>
    `${before}${milestones[index++].afterStep}${between}${quotedLabel}`,
  );
}
