import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function load(path, stubs = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (name) => stubs[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}

const rewardProgress = load("src/lib/rewardProgress.ts");
const { scansToNextReward, scansBetween } = rewardProgress;

/**
 * Mirrors `add_stamp`: record one stamp, then advance past any immediately
 * following reward steps, granting their vouchers. Tests assert against this
 * rather than against arithmetic, so they fail if the two ever diverge.
 */
function stamp(count, totalSteps, rewards) {
  const steps = new Set(rewards.map((r) => r.step));
  let next = count + 1;
  while (next < totalSteps && steps.has(next + 1)) next += 1;
  return next;
}

function scansUntil(from, totalSteps, rewards, target) {
  let count = from;
  let scans = 0;
  while (count < target) {
    count = stamp(count, totalSteps, rewards);
    scans += 1;
  }
  return scans;
}

test("the gift step is granted, not scanned, so it is not counted as a stamp", () => {
  const rewards = [{ step: 10, label: "Special gift" }];
  const progress = scansToNextReward(6, 10, rewards);

  assert.equal(progress.scans, 3, "6 of 10 with the gift on 10 is three scans away");
  assert.equal(
    progress.scans,
    scansUntil(6, 10, rewards, 10),
    "the count must match what stamping actually does",
  );
});

test("consecutive rewards collapse into a single scan", () => {
  const rewards = [
    { step: 9, label: "Free coffee" },
    { step: 10, label: "Special gift" },
  ];
  const progress = scansToNextReward(6, 10, rewards);

  assert.equal(progress.scans, 2);
  assert.equal(progress.scans, scansUntil(6, 10, rewards, 9));
  assert.equal(progress.reward.step, 9, "the nearest reward is the one promised");
});

test("a card with no rewards counts plain steps to completion", () => {
  const progress = scansToNextReward(6, 10, []);
  assert.equal(progress.scans, 4);
  assert.equal(progress.reward, null);
});

test("mid-card rewards are skipped on the way to a later one", () => {
  const rewards = [
    { step: 5, label: "Half way" },
    { step: 10, label: "Special gift" },
  ];
  // From 5, steps 6-9 are scanned and 10 is granted by the last of them.
  const progress = scansToNextReward(5, 10, rewards);
  assert.equal(progress.scans, 4);
  assert.equal(progress.scans, scansUntil(5, 10, rewards, 10));
});

test("one scan away reads as singular, which the UI depends on", () => {
  const rewards = [{ step: 10, label: "Special gift" }];
  assert.equal(scansToNextReward(8, 10, rewards).scans, 1);
});

test("a finished card has nothing left to promise", () => {
  assert.equal(scansToNextReward(10, 10, [{ step: 10, label: "Gift" }]), null);
  assert.equal(scansToNextReward(10, 10, []), null);
});

test("the wallet pass and the celebration dialog cannot disagree", () => {
  const { nextRewardLabel } = load("src/lib/walletFormat.ts", {
    "./rewardProgress": rewardProgress,
  });
  assert.equal(
    nextRewardLabel([{ step: 10, label: "Special gift" }], 6, 10),
    "Special gift — 3 stamps to go",
  );
  assert.equal(
    nextRewardLabel([{ step: 10, label: "Special gift" }], 8, 10),
    "Special gift — 1 stamp to go",
  );
});

test("scansBetween ignores steps already behind the customer", () => {
  assert.equal(scansBetween(6, 6, [{ step: 10 }]), 0);
  assert.equal(scansBetween(6, 7, []), 1);
});
