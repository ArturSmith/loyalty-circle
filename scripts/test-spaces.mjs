// Run with: node --test scripts/test-spaces.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, stubs = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)((name) => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
}

function fakeClient({ user = "me", fail, authError } = {}) {
  const records = {
    businesses: [
      { id: "owned", name: "My café", owner_id: "me", accepted_by_platform: true },
      { id: "admin", name: "Second café", owner_id: "someone", accepted_by_platform: true },
      { id: "pending", name: "Draft café", owner_id: "me", accepted_by_platform: false },
      { id: "inactive", owner_id: "someone" },
      { id: "unrelated", owner_id: "someone" },
      { id: "staff", owner_id: "someone" },
    ],
    business_members: [
      { business_id: "owned", user_id: "me", role: "admin", status: "active" },
      { business_id: "admin", user_id: "me", role: "admin", status: "active" },
      { business_id: "admin", user_id: "me", role: "admin", status: "active" },
      { business_id: "inactive", user_id: "me", role: "admin", status: "invited" },
      { business_id: "staff", user_id: "me", role: "staff", status: "active" },
      { business_id: "unrelated", user_id: "other", role: "admin", status: "active" },
    ],
  };
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: authError }) },
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        order() { return query; },
        eq(key, value) { filters.push((row) => row[key] === value); return query; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
        then(resolve, reject) {
          calls.push(table);
          return Promise.resolve({
            data: records[table].filter((row) => filters.every((filter) => filter(row))),
            error: fail === table ? new Error("Query failed") : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("workspace list includes owned and active admin businesses exactly once", async () => {
  const client = fakeClient();
  const { loadWorkspaceBusinesses } = load("src/lib/workspaces.ts", { "@/integrations/supabase/client": { supabase: client } });
  const rows = await loadWorkspaceBusinesses();
  assert.deepEqual(rows.map(({ id, role }) => ({ id, role })), [
    { id: "owned", role: "owner" }, { id: "pending", role: "owner" }, { id: "admin", role: "admin" },
  ]);
  assert.equal(rows[1].accepted_by_platform, false);
});

test("signed-out users never query business data", async () => {
  const client = fakeClient({ user: null });
  const { loadWorkspaceBusinesses } = load("src/lib/workspaces.ts", { "@/integrations/supabase/client": { supabase: client } });
  assert.deepEqual(await loadWorkspaceBusinesses(), []);
  assert.deepEqual(client.calls, []);
});

for (const options of [{ fail: "businesses" }, { fail: "business_members" }, { authError: new Error("Expired session") }]) {
  test(`failed ${options.fail ?? "auth"} request is not presented as an empty account`, async () => {
    const { loadWorkspaceBusinesses } = load("src/lib/workspaces.ts", {
      "@/integrations/supabase/client": { supabase: fakeClient(options) },
    });
    await assert.rejects(loadWorkspaceBusinesses());
  });
}

function menuHarness({ open = true, businesses = [], loading = false, failed = false, fetcher = async () => [] } = {}) {
  const states = [open, businesses, loading, failed];
  let cursor = 0;
  let effect;
  const dropdown = {
    DropdownMenu: ({ children }) => children,
    DropdownMenuTrigger: ({ children }) => children,
    DropdownMenuContent: ({ children, className }) => React.createElement("div", { role: "menu", className }, children),
    DropdownMenuItem: ({ children, disabled }) => React.cloneElement(children, { "aria-disabled": disabled || undefined }),
    DropdownMenuLabel: ({ children }) => React.createElement("p", null, children),
    DropdownMenuSeparator: () => React.createElement("hr"),
  };
  const { SpacesButton } = load("src/components/business/SpacesButton.tsx", {
    react: {
      ...React,
      useState: () => {
        const index = cursor++;
        return [states[index], (value) => { states[index] = value; }];
      },
      useEffect: (fn) => { effect = fn; },
    },
    "@/components/ui/button": { Button: ({ children, ...props }) => React.createElement("button", props, children) },
    "@/components/ui/dropdown-menu": dropdown,
    "@/lib/workspaces": { loadWorkspaceBusinesses: fetcher },
    "@tanstack/react-router": {
      Link: ({ to, search, children, ...props }) => React.createElement("a", {
        ...props, href: `${to}${Object.keys(search).length ? `?${new URLSearchParams(search)}` : ""}`,
      }, children),
    },
  });
  return {
    states,
    render: (props = { businessId: "owned" }) => {
      cursor = 0;
      return renderToStaticMarkup(React.createElement(SpacesButton, props));
    },
    runEffect: () => effect(),
  };
}

test("My Wallet is first and always available, even on load failure", () => {
  for (const state of [{}, { loading: true }, { failed: true }]) {
    const html = menuHarness(state).render();
    assert.match(html, /bg-primary/);
    assert.match(html, /Spaces/);
    assert.equal([...html.matchAll(/href="([^"]+)"/g)][0][1], "/wallet");
    assert.doesNotMatch(html, /Switch workspace/);
    if (state.failed) assert.match(html, /href="\/workspace"/);
  }
});

test("switcher shows current workspace, role and safe destination for pending businesses", () => {
  const html = menuHarness({ businesses: [
    { id: "owned", name: "My café", role: "owner", accepted_by_platform: true },
    { id: "admin", name: "Second café", role: "admin", accepted_by_platform: true },
    { id: "pending", name: "Draft", role: "owner", accepted_by_platform: false, onboarding_completed_at: "today" },
  ] }).render();
  assert.match(html, /Switch workspace/);
  assert.match(html, /aria-current="page" aria-disabled="true" href="\/business\?businessId=owned"/);
  assert.match(html, /href="\/business\?businessId=admin"/);
  assert.match(html, /href="\/business\/review\?businessId=pending"/);
  assert.match(html, /Awaiting approval/);
  assert.match(html, /Owner/);
  assert.match(html, /Admin/);
  assert.match(html, /overflow-wrap:anywhere/);
});

test("only one business does not add a redundant switcher section", () => {
  assert.doesNotMatch(menuHarness({ businesses: [{ id: "owned" }] }).render(), /Switch workspace/);
});

test("Wallet hides Spaces until a managed business is confirmed", async () => {
  for (const result of [[], [{ id: "owned", name: "My café", role: "owner", accepted_by_platform: true }]]) {
    let resolve;
    const harness = menuHarness({ open: false, loading: true, fetcher: () => new Promise((done) => { resolve = done; }) });
    assert.equal(harness.render({}), "");
    harness.runEffect();
    assert.equal(harness.render({}), "");
    resolve(result);
    await new Promise(setImmediate);
    const html = harness.render({});
    if (result.length === 0) assert.equal(html, "");
    else {
      assert.match(html, /Spaces/);
      assert.match(html, /href="\/business\?businessId=owned"/);
    }
  }
});

test("Wallet keeps Spaces hidden when membership lookup fails", async () => {
  const harness = menuHarness({ open: false, fetcher: async () => { throw new Error("Offline"); } });
  assert.equal(harness.render({}), "");
  harness.runEffect();
  await new Promise(setImmediate);
  assert.equal(harness.render({}), "");
});

test("Wallet offers even one workspace and marks My Wallet as current", () => {
  for (const role of ["owner", "admin"]) {
    const html = menuHarness({ businesses: [{ id: "business", name: "A café", role, accepted_by_platform: true }] }).render({});
    assert.match(html, /aria-current="page" aria-disabled="true" href="\/wallet"/);
    assert.match(html, /Switch workspace/);
    assert.match(html, /href="\/business\?businessId=business"/);
    assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 1);
  }
});

test("customer-only accounts have no managed workspaces", async () => {
  const { loadWorkspaceBusinesses } = load("src/lib/workspaces.ts", {
    "@/integrations/supabase/client": { supabase: fakeClient({ user: "customer" }) },
  });
  assert.deepEqual(await loadWorkspaceBusinesses(), []);
});

test("Wallet includes Spaces beside notifications without replacing Profile workspace navigation", () => {
  const wallet = read("src/routes/_authenticated/wallet.tsx");
  assert.match(wallet, /<SpacesButton \/>/);
  assert.ok(wallet.indexOf("<SpacesButton") < wallet.indexOf("<NotificationButton"));
  assert.match(wallet, /flex min-w-0 flex-1 items-center gap-3/);
  assert.match(wallet, /flex shrink-0 items-center gap-2/);
  const profile = read("src/routes/_authenticated/profile.tsx");
  assert.match(profile, /"\/workspace"/);
  assert.doesNotMatch(profile, /SpacesButton/);
});

test("workspace fetch is lazy and ignores results after the menu closes", async () => {
  let calls = 0;
  const closed = menuHarness({ open: false, fetcher: async () => { calls++; return []; } });
  closed.render();
  closed.runEffect();
  assert.equal(calls, 0);
  let resolve;
  const opened = menuHarness({ fetcher: () => { calls++; return new Promise((done) => { resolve = done; }); } });
  opened.render();
  const cleanup = opened.runEffect();
  assert.equal(calls, 1);
  cleanup();
  resolve([{ id: "late" }]);
  await new Promise(setImmediate);
  assert.deepEqual(opened.states[1], []);
});

test("dashboard action row can wrap instead of overflowing a narrow screen", () => {
  const source = read("src/routes/_authenticated/business.index.tsx");
  assert.match(source, /<header className="flex flex-wrap/);
  assert.match(source, /<SpacesButton businessId=\{biz.id\} \/>/);
  assert.ok(source.indexOf("<SpacesButton") < source.indexOf("<NotificationButton"));
});

test("new navigation labels have Norwegian translations", () => {
  const { nb } = load("src/i18n/nb.ts");
  for (const label of ["Spaces", "My Wallet", "Switch workspace", "Loading workspaces…", "Workspaces couldn’t be loaded.", "Open Workspace"]) {
    assert.ok(nb[label]);
  }
});
