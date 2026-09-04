import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function load(path, stubs) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (name) => stubs[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}

/** Runs `fn` with the wallet module loaded under a temporary `process.env`. */
function withWalletEnv(env, fn) {
  const previous = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return fn(load("src/lib/googleWallet.server.ts", {}));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const BASE_ENV = {
  GOOGLE_WALLET_ISSUER_ID: "3388000000000000000",
  GOOGLE_WALLET_SA_EMAIL: "wallet@example.iam.gserviceaccount.com",
  GOOGLE_WALLET_SA_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nAAAA\\n-----END PRIVATE KEY-----",
};

const reviewStatusFor = (value) =>
  withWalletEnv(
    { ...BASE_ENV, GOOGLE_WALLET_CLASS_REVIEW_STATUS: value },
    (wallet) => wallet.getWalletConfig().reviewStatus,
  );

test("an approved issuer publishes classes, everything else stays under review", () => {
  assert.equal(reviewStatusFor("APPROVED"), "APPROVED");
  assert.equal(reviewStatusFor("approved"), "APPROVED", "casing should not matter");

  // Anything other than an explicit opt-in must stay restricted, otherwise a
  // staging deploy would publish live passes to real users.
  for (const value of [undefined, "", "UNDER_REVIEW", "APPROVE", "yes", "true"]) {
    assert.equal(reviewStatusFor(value), "UNDER_REVIEW", `"${value}" must not publish`);
  }
});

test("missing secrets disable the feature rather than half-configuring it", () => {
  for (const missing of [
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_SA_EMAIL",
    "GOOGLE_WALLET_SA_PRIVATE_KEY",
  ]) {
    withWalletEnv({ ...BASE_ENV, [missing]: undefined }, (wallet) => {
      assert.equal(wallet.getWalletConfig(), null, `${missing} alone should disable wallet`);
    });
  }
});

test("escaped newlines in the deployed private key are restored to a real PEM", () => {
  withWalletEnv(BASE_ENV, (wallet) => {
    const { privateKey } = wallet.getWalletConfig();
    assert.ok(
      privateKey.includes("\n"),
      "secret stores flatten newlines; they must be re-expanded",
    );
    assert.ok(!privateKey.includes("\\n"));
  });
});

test("logos Google cannot rasterise are dropped instead of failing the class write", () => {
  withWalletEnv(BASE_ENV, ({ usableLogoUrl }) => {
    // The card editor accepts SVG uploads, but Google rejects them outright.
    assert.equal(usableLogoUrl("https://cdn.example.com/logo.svg"), null);
    assert.equal(usableLogoUrl("https://cdn.example.com/logo.svg?v=2"), null);
    assert.equal(usableLogoUrl("http://cdn.example.com/logo.png"), null, "must be https");
    assert.equal(usableLogoUrl(null), null);
    assert.equal(
      usableLogoUrl("https://cdn.example.com/logo.png"),
      "https://cdn.example.com/logo.png",
    );
  });
});

test("object and instance ids round-trip so callbacks map back to a card", () => {
  const events = load("src/lib/walletEvents.server.ts", {});
  const instanceId = "5b1c9f7e-2a44-4c1e-9f00-1234567890ab";

  withWalletEnv(BASE_ENV, (wallet) => {
    const objectId = wallet.objectIdFor(wallet.getWalletConfig(), instanceId);
    assert.equal(events.instanceIdFromGoogleObjectId(objectId), instanceId);
  });
});

/* ------------------------------------------------------------------- button */

function button(props, calls) {
  const Component = load("src/components/GoogleWalletButton.tsx", {
    // Stubbing state lets the click handler be invoked directly, without a DOM
    // and without asserting on React's internals.
    react: { ...React, useState: (initial) => [initial, () => {}] },
    "@tanstack/react-start": { useServerFn: (fn) => fn },
    "@/utils/wallet.functions": {
      createWalletPass: async ({ data }) => {
        calls.push({ kind: "template", data });
        return { saveUrl: "https://pay.google.com/gp/v/save/template-jwt" };
      },
      createWalletPassForOwnedCard: async ({ data }) => {
        calls.push({ kind: "instance", data });
        return { saveUrl: "https://pay.google.com/gp/v/save/instance-jwt" };
      },
    },
    "@/lib/walletSave": { openWalletSaveUrl: async (url) => calls.push({ kind: "open", url }) },
    sonner: { toast: { error: (message) => calls.push({ kind: "error", message }) } },
    "@/components/Spinner": { Spinner: () => null },
  }).GoogleWalletButton;
  return Component;
}

const clickHandlerOf = (Component, props) => Component(props).props.onClick;

test("a card already in the wallet offers Google Wallet without re-accepting terms", () => {
  const fresh = button({}, []);
  assert.match(
    renderToStaticMarkup(React.createElement(fresh, { mode: "instance", instanceId: "abc" })),
    /Add to Google Wallet/,
  );
  assert.match(
    renderToStaticMarkup(
      React.createElement(fresh, { mode: "instance", instanceId: "abc", alreadyAdded: true }),
    ),
    /In Google Wallet/,
    "an existing pass must not look like a new one",
  );
});

test("an anonymous visitor cannot mint a pass before accepting the terms", async () => {
  const calls = [];
  let requested = 0;
  const Component = button({}, calls);
  await clickHandlerOf(Component, {
    templateId: "tpl-1",
    acceptedTermsVersion: null,
    onTermsRequired: () => (requested += 1),
  })();

  assert.equal(requested, 1, "terms must be surfaced");
  assert.deepEqual(calls, [], "no pass may be created, and nothing may be opened");
});

test("accepting the terms creates the pass and hands the save URL to the opener", async () => {
  const calls = [];
  const Component = button({}, calls);
  await clickHandlerOf(Component, { templateId: "tpl-1", acceptedTermsVersion: 3 })();

  assert.deepEqual(calls, [
    { kind: "template", data: { templateId: "tpl-1", acceptedTermsVersion: 3 } },
    { kind: "open", url: "https://pay.google.com/gp/v/save/template-jwt" },
  ]);
});

test("an owned card is mirrored by instance id, never re-created from its template", async () => {
  const calls = [];
  const Component = button({}, calls);
  await clickHandlerOf(Component, { mode: "instance", instanceId: "inst-9" })();

  assert.deepEqual(calls, [
    { kind: "instance", data: { instanceId: "inst-9" } },
    { kind: "open", url: "https://pay.google.com/gp/v/save/instance-jwt" },
  ]);
  assert.ok(
    !calls.some((c) => c.kind === "template"),
    "mirroring an owned card must never mint a duplicate anonymous card",
  );
});

test("the save URL never reaches the WebView directly on native", () => {
  const source = read("src/lib/walletSave.ts");
  assert.match(source, /isNativeApp/);
  assert.match(source, /@capacitor\/browser/);

  // pay.google.com matches the `*.google.com` navigation allow-list that exists
  // for OAuth, so a plain navigation would trap the save page inside the app.
  const capacitor = read("capacitor.config.ts");
  assert.match(capacitor, /\*\.google\.com/);

  for (const file of [
    "src/components/GoogleWalletButton.tsx",
    "src/components/WalletChooser.tsx",
  ]) {
    assert.doesNotMatch(
      read(file),
      /window\.location\.href\s*=\s*saveUrl/,
      `${file} must route the save URL through openWalletSaveUrl`,
    );
  }
});

/* ------------------------------------------------------------------ server */

test("mirroring an owned card is scoped to its owner and reuses the existing object", () => {
  const source = read("src/utils/wallet.functions.ts");
  const handler = source.slice(source.indexOf("createWalletPassForOwnedCard"));
  const body = handler.slice(0, handler.indexOf("export const syncWalletPass"));

  assert.match(body, /requireSupabaseAuth/, "must not be callable anonymously");
  assert.match(body, /context\.supabase/, "ownership is proven by RLS, not by the admin client");
  assert.match(body, /\.eq\("customer_id", context\.userId\)/);
  assert.doesNotMatch(body, /\.insert\(/, "must never create another card instance");
  assert.match(body, /stampsCount: instance\.stamps_count/, "pass must carry the current progress");
});

test("a staging deploy cannot un-publish a live class on the shared issuer", () => {
  const source = read("src/lib/googleWallet.server.ts");
  const patched = source.slice(source.indexOf("const existing = await walletFetch"));

  // Staging and production share GOOGLE_WALLET_ISSUER_ID, and a class id is
  // derived only from the issuer and the template — so both environments write
  // to the identical class. Patching UNDER_REVIEW over it would break passes
  // customers already hold.
  assert.match(
    patched,
    /reviewStatus === "APPROVED"[\s\S]{0,120}delete patch\["reviewStatus"\]/,
    "an approved class must never be demoted by a non-approved deploy",
  );
});

test("a frozen business's pass is deactivated rather than left presentable", () => {
  const wallet = load("src/lib/googleWallet.server.ts", {});
  assert.equal(typeof wallet.buildSaveUrl, "function");

  const source = read("src/lib/googleWallet.server.ts");
  assert.match(
    source,
    /state: input\.frozen \? "INACTIVE" : "ACTIVE"/,
    "a card that cannot be stamped must not look usable at the counter",
  );

  const sync = read("src/lib/walletSync.server.ts");
  assert.match(sync, /get_frozen_business_ids/, "sync must reflect the freeze, not just stamps");
  assert.match(sync, /frozen,/);
});

test("syncing never throws, so a failed pass update cannot cost a customer their stamp", () => {
  const source = read("src/lib/walletSync.server.ts");

  for (const fn of ["syncOnePass", "syncStalePassesForCustomer"]) {
    const body = source.slice(source.indexOf(`export async function ${fn}`));
    const handler = body.slice(0, body.indexOf("\n}\n") + 3);
    assert.match(handler, /try \{/, `${fn} must not throw`);
    assert.match(handler, /catch \(error\)/, `${fn} must not throw`);
  }
});

/* -------------------------------------------------------------- lazy repair */

const walletSync = () => load("src/lib/walletSync.server.ts", {});

const instance = (overrides) => ({
  id: "inst-1",
  stamps_count: 3,
  google_object_id: "3388.objabc",
  anon_secret: null,
  wallet_synced_stamps: 3,
  wallet_synced_at: new Date().toISOString(),
  template: {
    id: "tpl",
    title: "Card",
    total_steps: 10,
    rewards: [],
    bg_color: null,
    google_class_id: "3388.tpl",
    business: { id: "biz", name: "Cafe" },
  },
  ...overrides,
});

test("a pass is stale exactly when it no longer matches the card it represents", () => {
  const { isStale } = walletSync();

  assert.equal(isStale(instance()), false, "an up-to-date pass must not be rewritten");

  // The scanner's best-effort push was lost: the card moved on, the pass did not.
  assert.equal(isStale(instance({ stamps_count: 4 })), true);

  // Never pushed at all.
  assert.equal(isStale(instance({ wallet_synced_stamps: null })), true);
  assert.equal(isStale(instance({ wallet_synced_at: null })), true);

  // Zero stamps is a real value, not "unsynced" - it must not loop forever.
  assert.equal(isStale(instance({ stamps_count: 0, wallet_synced_stamps: 0 })), false);
});

test("cards without a Google pass are never touched", () => {
  const { isStale } = walletSync();

  // The overwhelming majority of cards live only in the in-app wallet. Syncing
  // them would mean calling Google for customers who never opted in.
  assert.equal(isStale(instance({ google_object_id: null, wallet_synced_stamps: 0 })), false);
  assert.equal(
    isStale(instance({ template: { ...instance().template, google_class_id: null } })),
    false,
  );
});

test("passes refresh periodically so a freeze converges without a stamp", () => {
  const { isStale } = walletSync();
  const now = Date.now();

  // Freezing a business changes the pass but leaves no per-row marker, so
  // stamps alone would never detect it.
  const recent = instance({ wallet_synced_at: new Date(now - 60 * 60 * 1000).toISOString() });
  assert.equal(isStale(recent, now), false, "an hour old is not worth a write");

  const old = instance({ wallet_synced_at: new Date(now - 25 * 60 * 60 * 1000).toISOString() });
  assert.equal(isStale(old, now), true, "a day later it must reconcile");
});

test("a run is capped, and freshness is only recorded once Google accepts the write", () => {
  const source = read("src/lib/walletSync.server.ts");

  // Without a cap, a customer holding many stale passes would issue an
  // unbounded burst of third-party calls on a single wallet open.
  assert.match(source, /MAX_PER_RUN = \d+/);
  assert.match(source, /slice\(0, MAX_PER_RUN\)/);

  // The update must follow the push, otherwise a failed write is marked synced
  // and the pass stays permanently wrong.
  const push = source.slice(source.indexOf("async function pushOne"));
  assert.ok(
    push.indexOf("updateLoyaltyObject") < push.indexOf("wallet_synced_stamps"),
    "a pass may only be marked synced after Google has accepted it",
  );

  // One rejected pass must not prevent the others from being repaired.
  assert.match(source, /Promise\.allSettled/);
});

test("customers cannot mark their own passes as synced", () => {
  const migration = read("supabase/migrations/20260904120000_wallet_pass_lazy_sync.sql");

  // Granting this would let a customer pin a stale stamp count in place.
  assert.match(
    migration,
    /revoke update \(wallet_synced_stamps, wallet_synced_at\)[\s\S]*from authenticated, anon/,
  );
  assert.match(migration, /add column if not exists wallet_synced_stamps/);
  assert.match(migration, /add column if not exists wallet_synced_at/);
});

test("a freshly created pass is not immediately considered stale", () => {
  const source = read("src/utils/wallet.functions.ts");

  // Both creation paths write the object at a known count; recording it avoids
  // every new pass being rewritten on the customer's next wallet open.
  const owned = source.slice(source.indexOf("createWalletPassForOwnedCard"));
  assert.match(
    owned.slice(0, owned.indexOf("export const syncWalletPass")),
    /wallet_synced_stamps/,
  );

  const anonymous = source.slice(source.indexOf("export const createWalletPass"));
  assert.match(
    anonymous.slice(0, anonymous.indexOf("createWalletPassForOwnedCard")),
    /wallet_synced_stamps: 0/,
  );
});

test("the wallet repairs passes in the background, never blocking its cards", () => {
  const source = read("src/routes/_authenticated/wallet.tsx");

  assert.match(source, /syncStaleWalletPasses/);
  // Fire-and-forget: a wallet that fails to render because Google is slow would
  // be a far worse bug than a stale pass.
  assert.match(source, /void repairPasses\([\s\S]{0,80}\.catch\(\(\) => \{\}\)/);

  const load = source.slice(source.indexOf("const load = useCallback"));
  assert.doesNotMatch(
    load.slice(0, load.indexOf("}, [fetchWallet])")),
    /syncStaleWalletPasses|repairPasses/,
    "repair must not sit inside the card-loading path",
  );
});
