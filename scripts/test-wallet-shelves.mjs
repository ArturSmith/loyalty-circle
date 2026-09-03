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
  const source = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", source)((name) => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
}

const rows = [
  { id: "available", status: "unused", label: "Free coffee", created_at: "2026-09-01", accent_color: "#333333", business: { name: "Coffee shop" }, card_title: "Club card" },
  { id: "redeemed", status: "used", label: "Already redeemed reward", created_at: "2026-09-01", accent_color: "#333333", business: { name: "Coffee shop" }, card_title: "Club card" },
];
function vouchers(cached = rows) {
  return load("src/components/CustomerVouchers.tsx", {
    "@/lib/tabCache": { getTabCache: () => cached, setTabCache() {} },
    "@/components/Spinner": { PageLoader: () => React.createElement("span", null, "Loading") },
    "@tanstack/react-router": { Link: ({ to, children, ...props }) => React.createElement("a", { ...props, href: to }, children) },
    "@tanstack/react-start": { useServerFn: (fn) => fn },
    "@/components/TabScreen": { TabScreen: ({ title, children }) => React.createElement("main", { "data-title": title }, children) },
    "@/components/ShelfControls": { ShelfControls: ({ itemCount }) => React.createElement("span", { "data-shelf-count": itemCount }) },
    "@/components/ui/button": { Button: ({ children }) => React.createElement("button", null, children) },
    "@/components/QrDisplay": { QrDisplay: () => null },
    "@/components/OrnamentDivider": { OrnamentDivider: () => null },
    "@/integrations/supabase/client": { supabase: {} },
    "@/lib/native": { hapticTap() {} },
    "@/hooks/useUnusedVoucherCount": { publishUnusedVoucherCount() {} },
    "@/utils/vouchers.functions": { getMyVouchers() {} },
  }).CustomerVouchers;
}

test("Wallet's voucher shelf reuses cached available rewards without page navigation", () => {
  const html = renderToStaticMarkup(React.createElement(vouchers(), { horizontal: true }));
  assert.match(html, /wallet-vouchers/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /data-shelf-count="1"/);
  assert.match(html, /Free coffee/);
  assert.doesNotMatch(html, /Already redeemed reward|data-title=/);
  assert.match(html, /href="\/vouchers"/);
  const source = read("src/components/CustomerVouchers.tsx");
  assert.match(source, /setOpenId\(v.id\)/);
  assert.match(source, /stempel:voucher:\$\{open.id\}/);
  assert.match(source, /setOpenId\(null\); \/\/ the QR modal is spent/);
  assert.match(source, /setTabCache<MyVoucher\[\]>\(CACHE_KEY, rows\)/);
});

test("standalone Vouchers keeps its Available and Used tabs", () => {
  const html = renderToStaticMarkup(React.createElement(vouchers()));
  assert.match(html, /data-title="Vouchers"/);
  assert.match(html, />Available<\/button>/);
  assert.match(html, />Used<\/button>/);
  assert.doesNotMatch(html, /wallet-vouchers/);
});

test("empty voucher shelf has an explicit empty state", () => {
  const html = renderToStaticMarkup(React.createElement(vouchers([]), { horizontal: true }));
  assert.match(html, /No vouchers yet/);
  assert.doesNotMatch(html, /Already redeemed reward/);
});

test("desktop rows keep mobile stack behavior and order unchanged", () => {
  const source = read("src/routes/_authenticated/wallet.tsx");
  assert.match(source, /isDesktop \? instances : displayInstances/);
  assert.match(source, /drag=\{isDesktop \? false : "x"\}/);
  assert.match(source, /showFlipButton=\{isDesktop \|\| i === displayInstances.length - 1\}/);
  assert.match(source, /data-wallet-card-id=\{inst.id\}/);
  assert.match(source, /inline: "center"/);
  assert.match(source, /isDesktop && <CustomerVouchers horizontal/);
  const css = read("src/styles.css");
  assert.match(css, /\.wallet-cards \{ order: 1/);
  assert.match(css, /\.wallet-vouchers \{ order: 2/);
  assert.match(css, /\.wallet-discover \{ order: 3/);
  assert.doesNotMatch(css, /--app-desktop-header/);
});

test("desktop-only controls have a mobile-safe server snapshot", () => {
  let serverSnapshot;
  const hook = load("src/hooks/useDesktopLayout.ts", { react: { useSyncExternalStore: (_, __, server) => { serverSnapshot = server; return server(); } } });
  assert.equal(hook.DESKTOP_QUERY, "(min-width: 768px)");
  assert.equal(hook.useDesktopLayout(), false);
  assert.equal(serverSnapshot(), false);
});
