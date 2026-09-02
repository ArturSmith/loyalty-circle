// Run with: node --test scripts/test-onboarding-ui.mjs
// Render the real form with lightweight control stubs; no browser, auth, or DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const element =
  (tag) =>
  ({ children, ...props }) =>
    React.createElement(tag, props, children);
const stubs = {
  "@/integrations/supabase/client": { supabase: {} },
  "@/components/Spinner": { Spinner: () => null },
  "@/components/ui/input": { Input: element("input") },
  "@/components/ui/textarea": { Textarea: element("textarea") },
  "@/components/ui/label": { Label: element("label") },
  "@/components/ui/button": { Button: element("button") },
  "@/components/ui/select": {
    Select: ({ children }) => React.createElement("div", null, children),
    SelectTrigger: element("button"),
    SelectContent: element("div"),
    SelectValue: () => null,
    SelectItem: element("option"),
  },
};

function loadSource(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => stubs[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}

const { BusinessForm, emptyBusinessDetails, isSectionValid } = loadSource(
  "../src/components/BusinessForm.tsx",
);
const { cardDraftSchema } = loadSource("../src/lib/card-draft.ts");
const renderForm = (value, sections, showErrors) =>
  renderToStaticMarkup(
    React.createElement(BusinessForm, { value, sections, showErrors, onChange() {} }),
  );
const invalidCount = (markup) => (markup.match(/aria-invalid="true"/g) ?? []).length;

test("required business fields are not red before a Continue attempt", () => {
  assert.equal(invalidCount(renderForm(emptyBusinessDetails, ["basics", "address"], false)), 0);
});
test("Continue marks both missing basics red", () => {
  const markup = renderForm(emptyBusinessDetails, ["basics"], true);
  assert.equal(invalidCount(markup), 2);
  assert.equal((markup.match(/border-destructive/g) ?? []).length, 2);
  assert.equal(isSectionValid(emptyBusinessDetails, "basics"), false);
});
test("all four required address fields turn red, optional contact fields do not", () => {
  const markup = renderForm(emptyBusinessDetails, ["address", "contact"], true);
  assert.equal(invalidCount(markup), 4);
  assert.equal((markup.match(/border-destructive/g) ?? []).length, 4);
});
test("correcting required data clears the invalid state", () => {
  const details = {
    ...emptyBusinessDetails,
    name: "Test Café",
    category: "Café & coffee",
    address_line1: "Storgata 12",
    city: "Oslo",
    postal_code: "0155",
    country: "Norway",
  };
  assert.equal(invalidCount(renderForm(details, ["basics", "address"], true)), 0);
  assert.equal(isSectionValid(details, "basics"), true);
  assert.equal(isSectionValid(details, "address"), true);
});
test("whitespace and too-short values still fail validation", () => {
  const details = {
    ...emptyBusinessDetails,
    name: " a ",
    category: "  ",
    address_line1: "ab",
    city: " ",
    postal_code: " ",
    country: " ",
  };
  assert.equal(invalidCount(renderForm(details, ["basics", "address"], true)), 6);
});
test("a first card cannot be omitted or have empty terms", () => {
  assert.equal(cardDraftSchema.safeParse(null).success, false);
  const card = {
    title: "Coffee card",
    subtitle: null,
    description: null,
    corner_title: null,
    total_steps: 8,
    shape: "rounded",
    bg_color: "#ffffff",
    accent_color: "#000000",
    text_color: "#000000",
    stamp_icon: "coffee",
    logo_url: null,
    rewards: [{ step: 8, label: "Free coffee" }],
    active: true,
    grid_cols: null,
    terms_and_conditions: "One stamp per coffee. Redeem after eight stamps.",
  };
  assert.equal(cardDraftSchema.safeParse(card).success, true);
  assert.equal(cardDraftSchema.safeParse({ ...card, title: " " }).success, false);
  assert.equal(cardDraftSchema.safeParse({ ...card, terms_and_conditions: "" }).success, false);
  assert.equal(cardDraftSchema.safeParse({ ...card, total_steps: 33 }).success, false);
});
