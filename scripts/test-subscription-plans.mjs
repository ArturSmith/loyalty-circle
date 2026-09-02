// Run with: node --test scripts/test-subscription-plans.mjs
// Render the real routes/selector; mock auth, navigation and Paddle (no payments).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
let buttons, opened, destinations, priceRequests, notifications, navigation;
let access, owner, restricted, user;
const location = { pathname: "/business", search: { businessId: "business-b" } };
const div = ({ children, initial, animate, transition, ...props }) =>
  React.createElement("div", props, children);
const stubs = {
  "@tanstack/react-router": {
    useNavigate: () => (options) => navigation.push(options),
    useRouterState: ({ select }) => select({ location }),
    createFileRoute: () => (options) => ({ ...options, useSearch: () => ({}) }),
    Outlet: () => React.createElement("div", null, "Business dashboard"),
  },
  "@/components/ui/button": {
    Button: ({ children, variant, ...props }) => {
      buttons.push(props);
      return React.createElement("button", props, children);
    },
  },
  "@/components/Spinner": { ScreenLoader: () => React.createElement("div", null, "Loading") },
  "@/components/OrnamentDivider": { OrnamentDivider: div },
  "@/components/business/BusinessApprovalGate": {
    BusinessApprovalGate: ({ children }) => children,
  },
  "@/integrations/supabase/client": {
    supabase: { auth: { getUser: async () => ({ data: { user } }) } },
  },
  "@/hooks/useBusinessAccess": { useBusinessAccess: () => access, TRIAL_DAYS: 14 },
  "@/lib/navigationCache": {
    getNavigationCache: (key) => ({ value: key.includes("owner") ? owner : restricted }),
  },
  "framer-motion": { motion: { div } },
  sonner: { toast: { error: (...args) => notifications.push(args) } },
  "@/lib/paddle": {
    initializePaddle: async () => {},
    getPaddlePriceId: async (tier) => {
      priceRequests.push(tier);
      return `price-${tier}`;
    },
    subscribeToPaddleEvents: () => () => {},
  },
};

function loadSource(path) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
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
const plans = loadSource("../src/lib/plans.ts");
stubs["@/lib/plans"] = plans;
const selector = loadSource("../src/components/business/SubscriptionPlans.tsx");
stubs["@/components/business/SubscriptionPlans"] = selector;
const { Route: businessRoute } = loadSource("../src/routes/_authenticated/business.tsx");
const { Route: subscribeRoute } = loadSource("../src/routes/_authenticated/subscribe.tsx");
const renderGate = () => renderToStaticMarkup(React.createElement(businessRoute.component));

test.beforeEach(() => {
  buttons = [];
  opened = [];
  destinations = [];
  priceRequests = [];
  notifications = [];
  navigation = [];
  owner = true;
  restricted = false;
  user = { id: "owner-id", email: "owner@example.test" };
  access = {
    loading: false,
    hasAccess: false,
    hasBusiness: true,
    reason: "trial-expired",
    businessCount: 1,
    seatCount: 0,
  };
  globalThis.window = {
    location: { origin: "https://example.test" },
    Paddle: { Checkout: { open: (options) => opened.push(options) } },
  };
  globalThis.sessionStorage = { setItem: (key, value) => destinations.push({ key, value }) };
});
test.afterEach(() => {
  delete globalThis.window;
  delete globalThis.sessionStorage;
});

test("expired trial shows every plan, price, feature list and bottom-aligned action", () => {
  const markup = renderGate();
  assert.match(markup, /Your free trial has ended/);
  for (const plan of plans.PLAN_LIST) {
    assert.ok(markup.includes(`>${plan.name}</h2>`));
    assert.ok(markup.includes(plans.formatPlanPrice(plan.price)));
    assert.ok(markup.includes(`Choose ${plan.name}`));
  }
  assert.equal((markup.match(/<ul class="mt-6 flex-1/g) ?? []).length, plans.PLAN_LIST.length);
  assert.match(markup, /md:grid-cols-3/);
  assert.doesNotMatch(markup, /Plans from|See plans|In your trial/);
  assert.equal(buttons.length, plans.PLAN_LIST.length);
});

test("missing subscription / extra-seat gate also shows all plans", () => {
  access = { ...access, reason: "needs-more-seats", businessCount: 2, seatCount: 1 };
  const markup = renderGate();
  assert.match(markup, /Add a subscription for this business/);
  for (const plan of plans.PLAN_LIST) assert.ok(markup.includes(`Add ${plan.name}`));
});

test("each action uses its own tier and returns to the selected business", async () => {
  renderGate();
  for (const button of buttons) await button.onClick();
  assert.deepEqual(priceRequests, plans.PLAN_TIERS);
  assert.deepEqual(
    opened.map((checkout) => checkout.items[0].priceId),
    plans.PLAN_TIERS.map((tier) => `price-${tier}`),
  );
  assert.deepEqual(
    opened.map((checkout) => checkout.customData),
    plans.PLAN_TIERS.map((tier) => ({ userId: user.id, planTier: tier })),
  );
  assert.ok(
    destinations.every(
      ({ key, value }) =>
        key === "post_checkout_return" && value === "/business?businessId=business-b",
    ),
  );
  assert.equal(notifications.length, 0);
});

test("restricted administrator sees manager message, never subscription offers", () => {
  owner = false;
  restricted = true;
  const markup = renderGate();
  assert.match(markup, /Please contact the business manager/);
  assert.doesNotMatch(markup, /Choose Basic|Choose Pro|Choose Unlimited|249 kr/);
});

test("administrator of accessible business is not charged for their separate expired business", () => {
  owner = false;
  assert.match(renderGate(), /Business dashboard/);
  assert.equal(buttons.length, 0);
});

test("active owner does not see the paywall", () => {
  access = { ...access, hasAccess: true, reason: "subscribed" };
  assert.match(renderGate(), /Business dashboard/);
  assert.equal(buttons.length, 0);
});

test("standalone subscription route uses the same complete selector", () => {
  const markup = renderToStaticMarkup(React.createElement(subscribeRoute.component));
  for (const plan of plans.PLAN_LIST) assert.ok(markup.includes(`Choose ${plan.name}`));
});

test("loading access disables every checkout button", () => {
  access.loading = true;
  renderToStaticMarkup(React.createElement(selector.SubscriptionPlans, { access }));
  assert.equal(buttons.length, 3);
  assert.ok(buttons.every((button) => button.disabled));
});

test("trial selector keeps the trial badge and missing-business guard", async () => {
  access = { ...access, reason: "trialing", hasBusiness: false };
  const markup = renderToStaticMarkup(React.createElement(selector.SubscriptionPlans, { access }));
  assert.equal((markup.match(/In your trial/g) ?? []).length, 1);
  await buttons[0].onClick();
  assert.equal(opened.length, 0);
  assert.deepEqual(navigation, [{ to: "/business/onboarding" }]);
});

test("external return destination is rejected", async () => {
  renderToStaticMarkup(
    React.createElement(selector.SubscriptionPlans, { access, returnTo: "//other.example" }),
  );
  await buttons[0].onClick();
  assert.equal(destinations[0].value, "/business");
});
