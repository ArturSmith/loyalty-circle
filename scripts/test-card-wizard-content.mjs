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
const cardDraft = load("src/lib/card-draft.ts");
const { cardDraftSchema, DEFAULT_CARD_TERMS } = cardDraft;
const usage = load("src/lib/card-usage.ts");
const { getCardUsageRewards } = usage;
const accordion = load("src/components/ui/accordion.tsx", {
  "@/lib/utils": load("src/lib/utils.ts"),
});
const usageSection = load("src/components/CardUsageSection.tsx", {
  "@/components/ui/accordion": accordion,
  "@/lib/card-usage": usage,
  "@/lib/utils": load("src/lib/utils.ts"),
});
// Render the actual Radix accordion in its expanded state to inspect its copy.
const expandedUsage = (props) => renderToStaticMarkup(
  React.cloneElement(usageSection.CardUsageSection(props), { defaultValue: "usage" }),
);
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

async function wizard({ draftMode = true, draft = validDraft, edit = false, generate = async () => ({ terms: "Generated terms for this card." }) } = {}) {
  const states = [],
    effects = [],
    saved = [],
    queries = [],
    generationRequests = [],
    errors = [];
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
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
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
    "@tanstack/react-start": { useServerFn: (fn) => fn },
    "@/lib/card-terms.functions": { generateCardTerms: async ({ data }) => {
      generationRequests.push(data);
      return generate(data);
    } },
    "@/integrations/supabase/client": { supabase },
    "@/components/StampCard": stamp,
    "@/lib/card-draft": cardDraft,
    "@/components/CardUsageSection": usageSection,
    "@/components/Spinner": load("src/components/Spinner.tsx", { "@/lib/utils": load("src/lib/utils.ts") }),
    "@/components/ui/button": { Button: control("button") },
    "@/components/ui/input": { Input: control("input") },
    "@/components/ui/textarea": { Textarea: control("textarea") },
    "@/components/ui/label": { Label: control("label") },
    "@/components/ui/switch": { Switch: () => null },
    "@/components/OrnamentDivider": { OrnamentDivider: () => null },
    "@/components/BackButton": { BackButton: () => null },
    sonner: { toast: { error: (...args) => errors.push(args), success: () => {} } },
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
  const cleanup = effects[1]?.();
  await new Promise(setImmediate);
  render();
  return {
    saved,
    queries,
    generationRequests,
    errors,
    unmount: () => cleanup?.(),
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

test("AI terms generation sends the selected business and current card and inserts an editable draft", async () => {
  for (const draftMode of [true, false]) {
    const generated = "  Collect stamps and redeem your Free coffee voucher.  ";
    const h = await wizard({
      draftMode,
      edit: !draftMode,
      draft: { ...validDraft, rewards: [{ step: 8, label: "Free coffee" }, { step: 12, label: "Removed step" }] },
      generate: async () => ({ terms: generated }),
    });
    assert.equal(h.find((node) => node.props["aria-controls"] === "card-terms"), undefined);
    for (let i = 0; i < 3; i++) await h.click("Next");
    await h.find((node) => node.props["aria-controls"] === "card-terms").props.onClick();
    h.render();
    assert.deepEqual(h.generationRequests, [{
      businessName: draftMode ? "Onboarding Café" : "Business B",
      title: validDraft.title,
      subtitle: validDraft.subtitle,
      totalSteps: 8,
      rewards: [{ step: 8, label: "Free coffee" }],
    }]);
    const terms = h.find((node) => node.props.id === "card-terms");
    assert.equal(terms.props.value, generated.trim());
    assert.equal(terms.props.readOnly, false);
    assert.equal(h.saved.length, 0); // Generation alone never publishes/saves a card.
    terms.props.onChange({ target: { value: "Reviewed and edited by the owner." } });
    h.render();
    await h.click("Next");
    await h.click(draftMode ? "Save card draft" : "Save changes");
    assert.equal(h.saved[0].terms_and_conditions, "Reviewed and edited by the owner.");
  }
});

test("generation shows a spinner, prevents duplicate requests and preserves terms until success", async () => {
  let resolve;
  const h = await wizard({ generate: () => new Promise((done) => { resolve = done; }) });
  for (let i = 0; i < 3; i++) await h.click("Next");
  const button = h.find((node) => node.props["aria-controls"] === "card-terms");
  const pending = button.props.onClick();
  await button.props.onClick(); // Same-frame duplicate, before React has rerendered.
  h.render();
  assert.equal(h.generationRequests.length, 1);
  assert.equal(h.find((node) => node.props["aria-controls"] === "card-terms").props.disabled, true);
  assert.equal(h.find((node) => node.props.id === "card-terms").props.readOnly, true);
  assert.equal(h.find((node) => node.props.id === "card-terms").props.value, validDraft.terms_and_conditions);
  assert.match(h.html(), /Generating…/);
  assert.match(h.html(), /motion-safe:animate-spin/);
  assert.match(h.html(), /<button disabled="">Next/);
  resolve({ terms: "Generated terms after a streamed response." });
  await pending;
  h.render();
  assert.equal(h.find((node) => node.props["aria-controls"] === "card-terms").props.disabled, false);
  assert.equal(h.find((node) => node.props.id === "card-terms").props.readOnly, false);
});

for (const message of [
  "AI is busy right now. Please try again in a moment.", // 429
  "AI credits are exhausted for this workspace.", // 402
  "AI is not configured for this project.",
  "Network request failed",
]) {
  test(`AI error preserves existing terms and allows retry: ${message}`, async () => {
    let fail = true;
    const h = await wizard({ generate: async () => {
      if (fail) throw new Error(message);
      return { terms: "New terms after a successful retry." };
    } });
    for (let i = 0; i < 3; i++) await h.click("Next");
    await h.find((node) => node.props["aria-controls"] === "card-terms").props.onClick();
    h.render();
    assert.equal(h.find((node) => node.props.id === "card-terms").props.value, validDraft.terms_and_conditions);
    assert.equal(h.find((node) => node.props["aria-controls"] === "card-terms").props.disabled, false);
    assert.deepEqual(h.errors, [["Could not generate terms", { description: message }]]);
    fail = false;
    await h.find((node) => node.props["aria-controls"] === "card-terms").props.onClick();
    h.render();
    assert.equal(h.find((node) => node.props.id === "card-terms").props.value, "New terms after a successful retry.");
  });
}

test("late AI responses cannot overwrite terms after going back or unmounting", async () => {
  for (const leave of ["back", "unmount"]) {
    let resolve;
    const h = await wizard({ generate: () => new Promise((done) => { resolve = done; }) });
    for (let i = 0; i < 3; i++) await h.click("Next");
    const pending = h.find((node) => node.props["aria-controls"] === "card-terms").props.onClick();
    if (leave === "back") { await h.click("Back"); await h.click("Next"); }
    else h.unmount();
    resolve({ terms: "Stale generated terms must not be inserted." });
    await pending;
    h.render();
    assert.equal(h.find((node) => node.props.id === "card-terms").props.value, validDraft.terms_and_conditions);
    assert.equal(h.errors.length, 0);
  }
});

test("invalid AI output does not replace the current terms", async () => {
  const h = await wizard({ generate: async () => ({ terms: " " }) });
  for (let i = 0; i < 3; i++) await h.click("Next");
  await h.find((node) => node.props["aria-controls"] === "card-terms").props.onClick();
  h.render();
  assert.equal(h.find((node) => node.props.id === "card-terms").props.value, validDraft.terms_and_conditions);
  assert.equal(h.errors[0][1].description, "The AI returned invalid terms. Please try again.");
});

test("draft schema no longer requires or retains descriptions", () => {
  assert.ok(cardDraftSchema.safeParse(validDraft).success);
  assert.equal(
    "description" in cardDraftSchema.parse({ ...validDraft, description: "Legacy" }),
    false,
  );
});

test("new standalone and onboarding cards start at 10 steps in five columns with default terms", async () => {
  for (const draftMode of [false, true]) {
    const h = await wizard({ draftMode, draft: null });
    assert.equal(h.preview().props.totalSteps, 10);
    assert.equal(h.preview().props.gridCols, 5);
    await h.click("Next");
    await h.click("Next");
    assert.equal(h.find((node) => node.props.id === "card-total-steps").props.value, 10);
    const html = h.html();
    assert.match(html, /grid-template-columns:repeat\(5,/);
    assert.ok(html.indexOf("Tap on step to set rewards") < html.indexOf("perspective:1200px"));
    await h.click("Next");
    assert.equal(h.find((node) => node.props.id === "card-terms").props.value, DEFAULT_CARD_TERMS);
    await h.click("Next");
    await h.click(draftMode ? "Save card draft" : "Create card");
    assert.equal(h.saved[0].total_steps, 10);
    assert.equal(h.saved[0].grid_cols, 5);
    assert.equal(h.saved[0].terms_and_conditions, DEFAULT_CARD_TERMS);
  }
});

test("clearing the step count removes circles, leaves an empty input and saves zero", async () => {
  const h = await wizard({ draftMode: false });
  await h.click("Next");
  await h.click("Next");
  const count = () => h.find((node) => node.props.id === "card-total-steps");
  for (const value of ["", "0"]) {
    count().props.onChange({ target: { value } });
    h.render();
    assert.equal(count().props.value, "");
    assert.equal(h.preview().props.totalSteps, 0);
    assert.doesNotMatch(h.html(), /aria-label="Edit step/);
  }
  count().props.onChange({ target: { value: "8" } });
  h.render();
  assert.equal(count().props.value, 8);
  count().props.onChange({ target: { value: "" } });
  h.render();
  await h.click("Next");
  await h.click("Next");
  await h.click("Create card");
  assert.equal(h.saved[0].total_steps, 0);
});

test("existing card terms and grid choices are not replaced by new defaults", async () => {
  const h = await wizard({ draftMode: false, edit: true, draft: { ...validDraft, grid_cols: 4 } });
  assert.equal(h.preview().props.totalSteps, 8);
  assert.equal(h.preview().props.gridCols, 4);
  await h.click("Next");
  await h.click("Next");
  await h.click("Next");
  assert.equal(
    h.find((node) => node.props.id === "card-terms").props.value,
    validDraft.terms_and_conditions,
  );
});

test("usage instructions follow actual scan counts, including automatically filled reward circles", () => {
  const examples = [
    { steps: 10, rewards: [5, 10], scans: [4, 8] },
    { steps: 8, rewards: [8], scans: [7] },
    // Same two-reward configuration as the PostgreSQL stamp regression fixture.
    { steps: 5, rewards: [3, 5], scans: [2, 3] },
    { steps: 6, rewards: [2, 3, 4], scans: [1, 1, 1] },
    { steps: 4, rewards: [1, 4], scans: [3] },
  ];
  for (const { steps, rewards, scans } of examples) {
    assert.deepEqual(
      getCardUsageRewards(
        steps,
        rewards.map((step) => ({ step, label: `Gift ${step}` })),
      ).map((r) => r.stampsRequired),
      scans,
    );
  }
});

test("usage is regenerated from valid steps, ignores duplicates and out-of-range rewards", () => {
  const rewards = [
    { step: 10, label: "Free haircut" },
    { step: 5, label: " -50% " },
    { step: 5, label: "Duplicate" },
    { step: 2, label: " " },
    { step: 2.5, label: "Invalid" },
  ];
  assert.deepEqual(getCardUsageRewards(10, rewards), [
    { step: 5, label: "-50%", stampsRequired: 4 },
    { step: 10, label: "Free haircut", stampsRequired: 8 },
  ]);
  assert.deepEqual(getCardUsageRewards(5, rewards), [
    { step: 5, label: "-50%", stampsRequired: 4 },
  ]);
  assert.deepEqual(getCardUsageRewards(0, rewards), []);
  assert.deepEqual(getCardUsageRewards(10, null), []);
  assert.equal(rewards[0].step, 10); // Calculation does not mutate the draft.
});

test("step 5 review renders the same generated instructions used on the public page", async () => {
  const rewards = [
    { step: 5, label: "-50%" },
    { step: 10, label: "Free haircut" },
  ];
  const h = await wizard({ draft: { ...validDraft, total_steps: 10, rewards } });
  for (let i = 0; i < 4; i++) await h.click("Next");
  const html = h.html();
  assert.match(html, /How to use this card/);
  assert.match(html, /aria-expanded="false"/);
  const section = h.find((node) => node.type === usageSection.CardUsageSection);
  assert.equal(section.props.totalSteps, 10);
  assert.deepEqual(section.props.rewards, rewards);
  const description = expandedUsage(section.props);
  assert.match(description, /After step 4 you will get voucher for/);
  assert.match(description, /After step 8 you will get voucher for/);
  assert.match(description, /Free haircut/);
  const publicPage = readFileSync(
    new URL("../src/routes/b.$businessId.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    publicPage,
    /<CardUsageSection totalSteps=\{t\.total_steps\} rewards=\{t\.rewards\}/,
  );
  assert.match(publicPage, /const t = activeTemplate/);
});

test("generated text updates with a different card and renders benefit names safely", () => {
  const html = expandedUsage({
    totalSteps: 2,
    rewards: [{ step: 2, label: '<img src=x onerror="alert(1)">' }],
  });
  assert.match(html, /After step 1 you will get voucher for/);
  assert.doesNotMatch(html, /<img|After step 4 |After step 8 /);
  assert.match(html, /data-i18n-ignore/);
  const empty = expandedUsage({ totalSteps: 0, rewards: [] });
  assert.match(empty, /This card has no stamp steps/);
  assert.doesNotMatch(empty, /you will get voucher/);
});

test("usage is collapsed by default and expands to the requested voucher milestones", () => {
  const props = {
    totalSteps: 32,
    rewards: [8, 16, 24, 32].map((step) => ({ step, label: "Free coffee" })),
  };
  const closed = renderToStaticMarkup(React.createElement(usageSection.CardUsageSection, props));
  assert.match(closed, /<button[^>]+aria-expanded="false"/);
  assert.match(closed, /hidden=""[^>]*role="region"/);
  assert.doesNotMatch(closed, /After step/);
  const opened = expandedUsage(props);
  assert.match(opened, /aria-expanded="true"/);
  assert.doesNotMatch(opened, /aria-disabled="true"/); // Remains collapsible.
  for (const step of [7, 14, 21, 28]) {
    assert.match(opened, new RegExp(`After step ${step} you will get voucher for`));
  }
  assert.equal((opened.match(/‘Free coffee’/g) ?? []).length, 4);
  assert.doesNotMatch(opened, /earn present|Get \d+ stamps/);
});

test("benefits use the same circular border and a gift icon in preview and wallet", () => {
  const visit = (node) =>
    React.isValidElement(node)
      ? [node, ...React.Children.toArray(node.props.children).flatMap(visit)]
      : [];
  for (const editing of [false, true]) {
    for (const filled of [false, true]) {
      const clicked = [];
      const tree = stamp.StampCard({
        title: "Test card",
        totalSteps: 10,
        gridCols: 5,
        stampsCount: filled ? 5 : 0,
        rewards: [{ step: 5, label: "-50%" }],
        bgColor: "#ffffff",
        accentColor: "#000000",
        onStepClick: editing ? (step) => clicked.push(step) : undefined,
      });
      const reward = visit(tree).find((node) =>
        (node.props["aria-label"] ?? "").includes(editing ? "Edit reward on step 5" : "Step 5:"),
      );
      assert.match(reward.props.className, /rounded-full border-2/);
      assert.equal(reward.props.style.backgroundColor, filled ? "#000000" : "transparent");
      assert.equal(reward.props.style.color, filled ? "#ffffff" : "#000000");
      assert.match(renderToStaticMarkup(reward), /lucide-gift/);
      if (editing) {
        reward.props.onClick();
        assert.deepEqual(clicked, [5]);
      } else assert.equal(reward.props.title, filled ? "-50% — earned" : "-50%");
    }
  }
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
