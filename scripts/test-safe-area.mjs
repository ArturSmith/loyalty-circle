// Run with: node --test scripts/test-safe-area.mjs
// Source-level layout contracts; device/emulator visual checks are separate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("src/styles.css");

test("mobile web has safe-area defaults; Android overrides them with system insets", () => {
  const roots = [...css.matchAll(/:root\s*\{([^}]+)\}/g)].map((match) => match[1]).join("\n");
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.ok(roots.includes(`--safe-${side}: env(safe-area-inset-${side}, 0px)`));
    assert.ok(css.includes(`--safe-${side}: var(--android-inset-${side}, env(safe-area-inset-${side}, 0px))`));
  }
});

test("all normal pages receive shared scrollable bottom spacing", () => {
  const scroll = css.match(/\n#app-scroll\s*\{([^}]+)\}/)?.[1];
  assert.ok(scroll);
  assert.match(scroll, /padding-bottom: var\(--safe-bottom\)/);
  assert.match(scroll, /scroll-padding-bottom: var\(--safe-bottom\)/);
  assert.doesNotMatch(scroll, /height:|overflow:/); // Do not turn web into a nested scroller.
});

test("bottom navigation and chat composers use the platform-aware inset", () => {
  for (const path of [
    "src/components/BottomNav.tsx",
    "src/components/business/TeamChat.tsx",
    "src/routes/_authenticated/chats.$conversationId.tsx",
  ]) {
    assert.match(read(path), /paddingBottom: "var\(--safe-bottom\)"/, path);
  }
  assert.match(read("src/routes/_authenticated/business.onboarding.tsx"), /paddingBottom: "var\(--safe-bottom,/);
});

test("Team keeps its fixed shell and reserves room for the composer plus bottom inset", () => {
  const team = read("src/components/business/TeamChat.tsx");
  assert.match(read("src/routes/_authenticated/business.team.tsx"), /fixed inset-0 flex flex-col overflow-hidden/);
  assert.match(team, /min-h-0[^\n]+flex-1 overflow-y-auto/);
  assert.ok(team.includes("pb-[calc(6.5rem+var(--safe-bottom))]"));
});

test("full-screen QR overlays also respect the shared bottom inset", () => {
  assert.ok(read("src/components/CustomerQrCard.tsx").includes("pb-[max(0.75rem,var(--safe-bottom))]"));
  assert.ok(read("src/routes/_authenticated/business.scan.tsx").includes("pb-[max(1.25rem,var(--safe-bottom))]"));
});

test("Android republishes insets after a full page navigation", () => {
  const activity = read("android/app/src/main/java/com/clubcarder/app/MainActivity.java");
  assert.match(activity, /void onPageFinished\([^}]+ViewCompat\.requestApplyInsets\(view\)/);
});
