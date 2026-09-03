// Run with: node --test scripts/test-wallet-my-team.mjs
// Render the real routes and Radix tabs; no auth/network/DB mutations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
let search, role, loading, navigation, managementRequests, changeTab, back;
const stubs = {
  "@tanstack/react-router": {
    createFileRoute: () => (options) => ({ ...options, useSearch: () => search }),
    useNavigate: () => (options) => navigation.push(options),
    Navigate: (props) => {
      navigation.push(props);
      return null;
    },
    Link: ({ to, children }) => React.createElement("a", { href: to }, children),
  },
  "@/hooks/useBusinessPermissions": {
    useBusinessPermissions: (businessId) => {
      assert.equal(businessId, search.businessId);
      return { role, loading, isOwner: role === "owner", has: () => true, hasAny: () => true };
    },
  },
  "@/hooks/useUnreadChatCount": { useUnreadChatCount: () => 0 },
  "@/components/BackButton": {
    BackButton: ({ onClick, label }) => {
      back = onClick;
      return React.createElement("button", null, label);
    },
  },
  "@/components/Spinner": {
    ScreenLoader: () => React.createElement("p", null, "Loading"),
    Spinner: () => React.createElement("span", null, "Loading conversation"),
  },
  "@/components/TabScreen": { TabScreen: ({ children }) => children },
  "@/components/ui/button": {
    Button: ({ children }) => React.createElement("button", null, children),
  },
  "@/components/ui/textarea": { Textarea: () => React.createElement("textarea") },
  "@/integrations/supabase/client": { supabase: {} },
  "@/lib/post-sign-out": { postSignOutDestination: () => "/login" },
  "@tanstack/react-start": { useServerFn: (fn) => fn },
  "@/utils/team-chat.functions": {},
  "@/components/business/TeamManagement": {
    TeamManagement: ({ businessId }) => {
      managementRequests.push(businessId);
      return React.createElement("p", null, `Manage ${businessId}`);
    },
  },
};

function load(path, extra = {}) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => extra[name] ?? stubs[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
stubs["@/lib/utils"] = load("src/lib/utils.ts");
const tabs = load("src/components/ui/tabs.tsx");
stubs["@/components/ui/tabs"] = {
  ...tabs,
  Tabs: (props) => {
    changeTab = props.onValueChange;
    return React.createElement(tabs.Tabs, props);
  },
};
stubs["@/components/business/TeamChat"] = load("src/components/business/TeamChat.tsx");
const team = load("src/routes/_authenticated/business.team.tsx").Route;
const legacy = load("src/routes/_authenticated/business.workspace.tsx").Route;
const menu = load("src/routes/_authenticated/business.menu.tsx").Route;
const render = (route) => renderToStaticMarkup(React.createElement(route.component));

test.beforeEach(() => {
  search = { businessId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
  role = "owner";
  loading = false;
  navigation = [];
  managementRequests = [];
});

test("My team opens Group Chat by default and uses the shared back button", () => {
  const html = render(team);
  assert.match(html, />My team</);
  assert.match(html, /Group Chat/);
  assert.match(html, /Members &amp; permissions/);
  assert.deepEqual(managementRequests, []);
  back();
  assert.deepEqual(navigation, [{ to: "/business", search: { businessId: search.businessId } }]);
});

test("both team tabs stretch to the full row height when a label wraps", () => {
  for (const view of ["chat", "members"]) {
    search.view = view;
    const html = render(team);
    const tabList = html.match(/<div[^>]*role="tablist"[^>]*>/)?.[0];
    assert.ok(tabList);
    assert.match(tabList, /grid-cols-2 items-stretch/);
    assert.match(tabList, /h-auto/);
    assert.doesNotMatch(tabList, /items-center/);
  }
});

test("owner switches to management on the same route and selected business", () => {
  render(team);
  changeTab("members");
  assert.deepEqual(navigation[0], {
    to: "/business/team",
    search: { ...search, view: "members" },
    replace: true,
  });
  search = navigation[0].search;
  const html = render(team);
  assert.match(html, /Manage bbbbbbbb/);
  assert.doesNotMatch(html, /Group Chat/);
  assert.deepEqual(managementRequests, [search.businessId]);
  changeTab("chat");
  search = navigation[1].search;
  assert.match(render(team), /Group Chat/);
});

test("administrators only see chat, even if the URL requests management", () => {
  role = "admin";
  search.view = "members";
  const html = render(team);
  assert.match(html, /Group Chat/);
  assert.doesNotMatch(html, /Members &amp; permissions|Manage bbbbbbbb/);
  assert.deepEqual(managementRequests, []);
});

test("loading and non-members cannot mount team content", () => {
  loading = true;
  assert.equal(render(team), "<p>Loading</p>");
  loading = false;
  role = null;
  assert.equal(render(team), "");
  assert.deepEqual(navigation, [{ to: "/workspace", replace: true }]);
  assert.deepEqual(managementRequests, []);
});

test("both roles get exactly one My team menu entry", () => {
  for (const memberRole of ["owner", "admin"]) {
    role = memberRole;
    const html = render(menu);
    assert.equal((html.match(/href="\/business\/team"/g) ?? []).length, 1);
    assert.match(html, /My team/);
    assert.doesNotMatch(html, /Team &amp; permissions|\/business\/workspace/);
  }
});

test("old chat URLs redirect without losing business selection", () => {
  render(legacy);
  assert.deepEqual(navigation, [{ to: "/business/team", search, replace: true }]);
});

test("Wallet QR and its wrapper have no drop shadow", () => {
  const source = read("src/components/CustomerQrCard.tsx");
  const widget = source.slice(source.indexOf("<button"), source.indexOf("<Maximize2"));
  const qrContainer = widget.slice(0, widget.indexOf("<QrDisplay"));
  assert.doesNotMatch(qrContainer, /shadow-|drop-shadow|boxShadow/);
  assert.match(qrContainer, /bg-white/); // Keep QR contrast/brightness.
});

test("compact Wallet QR omits the title and name without shrinking the QR", () => {
  const { CustomerQrCard } = load("src/components/CustomerQrCard.tsx", {
    "@/components/QrDisplay": {
      QrDisplay: ({ value, size }) => React.createElement("canvas", { "data-qr": value, width: size, height: size }),
    },
    "@/lib/customer-code": load("src/lib/customer-code.ts"),
    "@/lib/native": { setUserQrBrightness: () => {} },
  });
  const html = renderToStaticMarkup(React.createElement(CustomerQrCard, {
    userId: "123e7a22-0000-4000-8000-000000000000",
    qrToken: "customer-token",
    displayName: "Artur Smit",
  }));
  assert.doesNotMatch(html, /My QR|MY QR|Artur Smit|Customer code/);
  assert.match(html, /Show this when a business adds a stamp/);
  assert.match(html, /123E-7A22/);
  assert.match(html, /aria-label="Open my customer QR"/);
  assert.match(html, /data-qr="stempel:user:customer-token" width="80" height="80"/);
  assert.match(html, /h-22 w-22/);
  assert.match(html, /bg-card p-2/);
});

test("Discover strip only scrolls manually", () => {
  const source = read("src/components/DiscoverStrip.tsx");
  assert.match(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /requestAnimationFrame|scrollLeft|scrollTo|setInterval/);
});

test("business info fades into the page with only top corners rounded", () => {
  const source = read("src/routes/b.$businessId.tsx");
  assert.match(source, /linear-gradient\(180deg,.*transparent 100%\)/);
  assert.match(source, /rounded-t-3xl px-5 pb-3 pt-6 text-center/);
  assert.doesNotMatch(source, /borderColor: brandTint/);
});

test("business profile removes the card prompt and keeps the stack close to the divider", () => {
  const source = read("src/routes/b.$businessId.tsx");
  assert.doesNotMatch(source, /Choose a loyalty card to add to your wallet/);
  assert.match(source, /\(cardsLoadError \|\| templates\.length === 0\) &&/);
  assert.match(source, /Loyalty cards could not be loaded/);
  assert.match(source, /No loyalty cards available right now/);
  assert.match(source, /OrnamentDivider className="mx-auto mt-4 w-40 opacity-60"/);
  assert.match(source, /<section className="business-public-cards mt-3" aria-label="Loyalty cards">/);
  // Keep the responsive stack's reserved space so it cannot overlap the
  // usage and terms widgets below it while tightening the gap above it.
  assert.match(source, /className="aspect-\[1\.586\/1\]"/);
  assert.match(source, /style=\{\{ height: stackOffset \}\}/);
});

test("new team labels have Norwegian translations", () => {
  const { nb } = load("src/i18n/nb.ts");
  assert.equal(nb["My team"], "Mitt team");
  assert.equal(nb["Members & permissions"], "Medlemmer og tillatelser");
});

for (const selected of ["business-b", "missing", undefined]) {
  test(`team entitlements stay scoped to ${selected ?? "legacy default"}`, async () => {
    const states = [],
      queries = [];
    let cursor = 0,
      effect;
    const records = {
      businesses: [
        { id: "business-a", owner_id: "owner" },
        { id: "business-b", owner_id: "owner" },
      ],
      business_members: [],
      subscriptions: [],
      business_locations: [],
      card_templates: [],
    };
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
      from(table) {
        const filters = [];
        let single = false,
          limit = Infinity,
          count = false;
        const query = {
          select(_columns, options) {
            count = Boolean(options?.count);
            return query;
          },
          eq(column, value) {
            filters.push([column, value]);
            return query;
          },
          neq() {
            return query;
          },
          order() {
            return query;
          },
          limit(value) {
            limit = value;
            return query;
          },
          maybeSingle() {
            single = true;
            return query;
          },
          then(resolve, reject) {
            queries.push({ table, filters, count });
            const rows = records[table]
              .filter((row) => filters.every(([col, val]) => row[col] === val))
              .slice(0, limit);
            return Promise.resolve({
              data: single ? (rows[0] ?? null) : rows,
              count: count ? rows.length : null,
            }).then(resolve, reject);
          },
        };
        return query;
      },
    };
    const { useEntitlements } = load("src/hooks/useEntitlements.ts", {
      react: {
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
          effect = fn;
        },
        useCallback: (fn) => fn,
      },
      "@/integrations/supabase/client": { supabase },
      "@/lib/plans": load("src/lib/plans.ts"),
      "@/lib/paddle": { getPaddleEnvironment: () => "sandbox" },
    });
    useEntitlements(selected);
    effect();
    await new Promise(setImmediate);
    cursor = 0;
    const result = useEntitlements(selected);
    const expected = selected === "missing" ? null : (selected ?? "business-a");
    assert.equal(result.loading, false);
    assert.equal(result.businessId, expected);
    assert.equal(result.role, expected ? "owner" : null);
    for (const query of queries.filter((q) => q.count)) {
      assert.deepEqual(query.filters, [["business_id", expected]]);
    }
    if (selected === "missing") assert.equal(queries.filter((q) => q.count).length, 0);
  });
}
