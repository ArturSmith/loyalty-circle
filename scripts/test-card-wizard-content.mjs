// Run with: node --test scripts/test-card-wizard-content.mjs
// Exercise the actual wizard state and save payloads without network/DB writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const load = (path, stubs = {}) => {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => stubs[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
};
const stamp = load("src/components/StampCard.tsx");
const { cardDraftSchema } = load("src/lib/card-draft.ts");
const validDraft = {
  title: "Coffee card",
  subtitle: "Enjoy your coffee",
  corner_title: null,
  total_steps: 8,
  shape: "rounded",
  bg_color: "#ffffff",
  accent_color: "#000000",
  text_color: "#000000",
  stamp_icon: "coffee",
  logo_url: null,
  rewards: [],
  active: true,
  grid_cols: null,
  terms_and_conditions: "One stamp per coffee. Redeem after eight stamps.",
};
const control =
  (tag) =>
  ({ children, variant, size, ...props }) =>
    React.createElement(tag, props, children);

async function wizard({ draftMode = true, draft = validDraft, edit = false } = {}) {
  const states = [],
    effects = [],
    saved = [],
    queries = [];
  let cursor = 0,
    tree;
  const fakeReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value) => {
          states[index] = typeof value === "function" ? value(states[index]) : value;
        },
      ];
    },
    useEffect(fn) {
      effects.push(fn);
    },
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from(table) {
      const query = {
        select: () => query,
        eq: (field, value) => {
          queries.push({ table, field, value });
          return query;
        },
        maybeSingle: async () => ({
          data: table === "businesses" ? { id: "business-b", name: "Business B" } : draft,
        }),
        insert: async (payload) => {
          saved.push(payload);
          return { error: null };
        },
      };
      return query;
    },
    rpc: async (name, payload) => {
      if (name === "get_pending_moderation") return { data: null };
      saved.push(payload._changes);
      return { error: null };
    },
  };
  const { CardWizard } = load("src/components/CardWizard.tsx", {
    react: fakeReact,
    "@tanstack/react-router": { useNavigate: () => () => {} },
    "@/integrations/supabase/client": { supabase },
    "@/components/StampCard": stamp,
    "@/components/Spinner": { ScreenLoader: () => null },
    "@/components/ui/button": { Button: control("button") },
    "@/components/ui/input": { Input: control("input") },
    "@/components/ui/textarea": { Textarea: control("textarea") },
    "@/components/ui/label": { Label: control("label") },
    "@/components/ui/switch": { Switch: () => null },
    "@/components/OrnamentDivider": { OrnamentDivider: () => null },
    "@/components/BackButton": { BackButton: () => null },
    sonner: { toast: { error: () => {}, success: () => {} } },
  });
  const props = draftMode
    ? {
        businessName: "Onboarding Café",
        draft,
        onDraftComplete: (value) => saved.push(value),
        onCancel() {},
      }
    : { businessId: "business-b", ...(edit ? { templateId: "template-b" } : {}) };
  const render = () => {
    cursor = 0;
    tree = CardWizard(props);
    return tree;
  };
  const nodes = (node = tree) =>
    React.isValidElement(node)
      ? [node, ...React.Children.toArray(node.props.children).flatMap((child) => nodes(child))]
      : [];
  const find = (predicate) => nodes().find(predicate);
  const click = async (label) => {
    const button = find((node) =>
      React.Children.toArray(node.props.children).some(
        (child) => typeof child === "string" && child.trim() === label,
      ),
    );
    assert.ok(button, `Missing button: ${label}`);
    await button.props.onClick();
    render();
  };
  render();
  effects[0]();
  await new Promise(setImmediate);
  render();
  return {
    saved,
    queries,
    render,
    find,
    click,
    preview: () => find((node) => node.type === stamp.StampCard),
    html: () => renderToStaticMarkup(tree),
    async save() {
      for (let i = 0; i < 4; i++) await click("Next");
      await click(draftMode ? "Save card draft" : edit ? "Save changes" : "Create card");
    },
  };
}

test("cards ignore legacy descriptions and default the corner to the business name", () => {
  for (const cornerTitle of [null, "", "  "]) {
    const html = renderToStaticMarkup(
      React.createElement(stamp.StampCard, {
        title: "Coffee card",
        businessName: "My Café",
        cornerTitle,
        totalSteps: 8,
        description: "Old description",
        onDescriptionClick() {},
        face: "info",
      }),
    );
    assert.match(html, /My Café/);
    assert.doesNotMatch(html, /Old description|Add description/);
  }
  const html = renderToStaticMarkup(
    React.createElement(stamp.StampCard, {
      title: "Coffee card",
      businessName: "My Café",
      cornerTitle: "Custom corner",
      totalSteps: 8,
    }),
  );
  assert.match(html, /Custom corner/);
  assert.doesNotMatch(html, /My Café/);
});

test("draft schema no longer requires or retains descriptions", () => {
  assert.ok(cardDraftSchema.safeParse(validDraft).success);
  assert.equal(
    "description" in cardDraftSchema.parse({ ...validDraft, description: "Legacy" }),
    false,
  );
});

test("onboarding uses its company name, no description, and a hint above the preview", async () => {
  const h = await wizard();
  assert.equal(h.preview().props.businessName, "Onboarding Café");
  const html = h.html();
  assert.doesNotMatch(html, /Description|description/);
  assert.ok(html.indexOf("Tap the title, subtitle or icon") < html.indexOf("Onboarding Café"));
  assert.match(html, /placeholder="Each 8th cup of coffee is free"/);
  h.preview().props.onSubtitleClick();
  h.render();
  assert.equal((h.html().match(/placeholder="Each 8th cup of coffee is free"/g) ?? []).length, 2);
  await h.save();
  assert.equal("description" in h.saved[0], false);
  assert.equal(h.saved[0].corner_title, null);
});

test("new cards load the selected company's name, including for an administrator", async () => {
  const h = await wizard({ draftMode: false });
  assert.equal(h.preview().props.businessName, "Business B");
  assert.deepEqual(h.queries, [{ table: "businesses", field: "id", value: "business-b" }]);
});

test("editing keeps custom corners; reset or empty returns to the company default", async () => {
  for (const reset of [true, false]) {
    const h = await wizard({
      draftMode: false,
      edit: true,
      draft: { ...validDraft, corner_title: "Custom corner", description: "Old description" },
    });
    assert.equal(h.preview().props.cornerTitle, "Custom corner");
    h.preview().props.onCornerTitleClick();
    h.render();
    if (reset) await h.click("Reset");
    else {
      h.find((node) => node.props.placeholder === "Business B").props.onChange({
        target: { value: "" },
      });
      h.render();
    }
    assert.match(h.html(), /Business B/);
    assert.doesNotMatch(h.html(), /Custom corner|Old description/);
    await h.save();
    assert.equal(h.saved[0].corner_title, null);
    assert.equal("description" in h.saved[0], false);
  }
});
