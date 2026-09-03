// Run with: node --test scripts/test-landing-program-steps.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("landing page explains the complete business launch path in order", () => {
  const source = read("src/routes/index.tsx");
  const launchSteps = source.slice(source.indexOf("const programLaunchSteps"), source.indexOf("function Landing"));
  const expected = [
    "Sign up",
    "Create your company",
    "Build your loyalty card",
    "Submit for approval",
    "Publish and share",
  ];

  assert.equal((launchSteps.match(/step: \d/g) ?? []).length, 5);
  let previous = -1;
  for (const label of expected) {
    const position = launchSteps.indexOf(`title: "${label}"`);
    assert.ok(position > previous, `${label} should appear in sequence`);
    previous = position;
  }
  assert.match(source, /<section id="start-a-program"/);
  assert.match(source, /<ol className="relative grid gap-3 lg:grid-cols-5/);
  assert.match(source, /<a href="#start-a-program">/);
  assert.match(source, /hidden font-display[^\n]*min-\[440px\]:inline/);
  assert.match(source, /text-\[clamp\(1\.5rem,7vw,2\.25rem\)\]/);
  assert.match(source, /min-h-12 w-full whitespace-normal[^\n]*sm:w-auto/);
  assert.match(source, /Start your loyalty program/);
  assert.match(source, /Your free trial starts when your company is approved\./);
  assert.match(source, /<Link to="\/auth">/);
});

test("new launch guidance is available in Norwegian Bokmål", () => {
  const translations = read("src/i18n/nb.ts");
  for (const label of [
    "Launch your loyalty program in five steps",
    "Create your company",
    "Build your loyalty card",
    "Submit for approval",
    "Publish and share",
    "Start your loyalty program",
  ]) {
    assert.ok(translations.includes(`"${label}":`), `missing translation: ${label}`);
  }
});
