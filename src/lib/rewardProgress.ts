/**
 * How many more scans a customer needs.
 *
 * The obvious answer — `rewardStep - stampsCount` — is wrong, and visibly so.
 * Reward steps are not earned by scanning. `add_stamp` records one stamp and
 * then, while the *next* step is a reward step, advances the counter past it and
 * issues the voucher in the same transaction:
 *
 *     loop
 *       exit when v_new_count >= v_template.total_steps;
 *       select ... where (r->>'step')::int = v_new_count + 1;
 *       exit when v_reward is null;
 *       v_new_count := v_new_count + 1;   -- reward step, granted not scanned
 *       insert into public.vouchers ...
 *     end loop;
 *
 * So on a 10-step card with the gift on step 10, a customer holding 6 stamps
 * needs three scans, not four: 7, 8, then 9 — which cascades straight to 10 and
 * hands over the voucher. Counting the gift cell as scannable overstates every
 * card by one per reward, which reads as the app moving the goalposts.
 */

export type RewardStep = { step: number; label?: string };

/** Steps in `(from, to]` that a customer has to actually collect. */
export function scansBetween(from: number, to: number, rewards: RewardStep[]): number {
  const rewardSteps = new Set(
    rewards.filter((r) => typeof r?.step === "number").map((r) => r.step),
  );
  let scans = 0;
  for (let step = from + 1; step <= to; step += 1) {
    if (!rewardSteps.has(step)) scans += 1;
  }
  return scans;
}

/**
 * Scans until the next reward, or until the card is full when no reward
 * remains. Null once there is nothing left to collect.
 */
export function scansToNextReward(
  stampsCount: number,
  totalSteps: number,
  rewards: RewardStep[],
): { scans: number; reward: RewardStep | null } | null {
  const upcoming = rewards
    .filter((r) => typeof r?.step === "number" && r.step > stampsCount)
    .sort((a, b) => a.step - b.step)[0];

  const target = upcoming ? upcoming.step : totalSteps;
  if (stampsCount >= target) return null;

  return { scans: scansBetween(stampsCount, target, rewards), reward: upcoming ?? null };
}
