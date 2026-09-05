// Run with: node --test scripts/test-bottom-nav.mjs
// Render the real navigation with local routing/count fixtures; no account access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function navigationHelpers() {
  const module = { exports: {} };
  const compiled = ts.transpileModule(read("src/lib/defaultHome.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

function navigation({ active = "/profile", vouchers = 0, chats = 0 } = {}) {
  const module = { exports: {} };
  const stubs = {
    "@tanstack/react-router": {
      Link: ({ to, activeProps, activeOptions, children, className, ...props }) => {
        assert.equal(activeOptions.exact, true);
        const selected = to === active ? activeProps : {};
        return React.createElement("a", {
          ...props,
          ...selected,
          href: to,
          className: `${className} ${selected.className ?? ""}`,
        }, children);
      },
    },
    "@/hooks/useUnusedVoucherCount": { useUnusedVoucherCount: () => vouchers },
    "@/hooks/useUnreadChatCount": { useUnreadChatCount: () => chats },
    "@/components/DesktopAccountTools": { DesktopAccountTools: () => null },
  };
  const compiled = ts.transpileModule(read("src/components/BottomNav.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)(
    (name) => stubs[name] ?? require(name), module, module.exports,
  );
  return module.exports;
}

export function renderBottomNav(options) {
  return renderToStaticMarkup(React.createElement(navigation(options).BottomNav));
}

test("the glass navigation keeps all five routes with exactly one active tab", () => {
  for (const active of ["/wallet", "/vouchers", "/discover", "/chats", "/profile"]) {
    const html = renderBottomNav({ active });
    assert.equal((html.match(/<a /g) ?? []).length, 5);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`aria-current="page"[^>]*href="${active}"`));
    assert.match(html, /glass-tab-link-active/);
    assert.match(html, /aria-label="Main navigation"/);
    for (const label of ["Wallet", "Vouchers", "Discover", "Chats", "Profile"]) {
      assert.ok(html.includes(`>${label}</span>`));
    }
  }
});

test("badge counts stay accessible and their visual count caps at 9+", () => {
  const html = renderBottomNav({ vouchers: 12, chats: 3 });
  assert.match(html, /aria-label="Vouchers, 12 unused"/);
  assert.match(html, /aria-label="Chats, 3 unread"/);
  assert.match(html, />9\+<\/span>/);
  assert.match(html, />3<\/span>/);
  assert.doesNotMatch(renderBottomNav(), />0<\/span>|9\+/);
});

test("floating glass keeps safe areas and existing bottom content clearance", () => {
  const html = renderBottomNav();
  assert.match(html, /padding-bottom:var\(--safe-bottom\)/);
  assert.match(html, /var\(--safe-left\)/);
  assert.match(html, /var\(--safe-right\)/);
  assert.match(html, /grid-cols-5/);
  assert.match(html, /min-h-14/); // 56px targets, over the 44px mobile minimum.
  assert.match(html, /min-\[360px\]:text-\[10px\]/);
  assert.match(html, /max-w-full truncate/); // Long translations never overlap another tab.
  assert.match(html, /pointer-events-none/);
  assert.match(html, /pointer-events-auto/);
  assert.match(read("src/components/TabScreen.tsx"), /pb-24/);
  assert.match(read("src/routes/_authenticated/wallet.tsx"), /pb-24/);
});

test("glass has blur fallback, keyboard focus and accessibility preferences", () => {
  const css = read("src/styles.css");
  assert.match(css, /\.glass-tab-bar \{[^}]*background: var\(--card\)/);
  assert.match(css, /-webkit-backdrop-filter: blur\(24px\) saturate\(1\.8\)/);
  assert.match(css, /\.glass-tab-link:focus-visible/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
});

test("detail pages still do not display the shared tab bar", () => {
  const { isTabRoute } = navigation();
  assert.equal(isTabRoute("/profile"), true);
  for (const path of ["/chats/conversation", "/business", "/b/business", "/notifications"]) {
    assert.equal(isTabRoute(path), false);
  }
});

test("desktop app navigation includes details but not marketing or auth screens", () => {
  const { isCustomerAppRoute, isTabRoute } = navigation();
  for (const path of ["/wallet", "/chats/", "/chats/thread", "/discover/category/Coffee", "/b/business", "/workspace", "/notifications"]) {
    assert.equal(isCustomerAppRoute(path), true, path);
  }
  for (const path of ["/", "/auth", "/pricing", "/business", "/business/onboarding", "/help", "/contact"]) {
    assert.equal(isCustomerAppRoute(path), false, path);
  }
  assert.equal(isTabRoute("/chats/"), true);
  const html = renderToStaticMarkup(React.createElement(navigation().BottomNav, { desktopOnly: true }));
  assert.match(html, /hidden md:block/);
  assert.match(html, /app-navigation-brand/);
  assert.match(html, /ClubCarder/);
});

test("website navigation and content spacing activate at the same tablet breakpoint", () => {
  const css = read("src/styles.css");
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /#app-scroll\.responsive-app-shell \{ margin-left: var\(--app-sidebar-width\)/);
  assert.match(css, /\.responsive-app-shell \.tab-screen-header \{ top: 0/);
  assert.match(css, /\.app-navigation, \.business-desktop-navigation \{\s*top: 0;\s*bottom: 0;/);
  assert.match(css, /html\.capacitor-native \.business-desktop-navigation \{\s*top: var\(--safe-top\)/);
  assert.match(read("src/routes/__root.tsx"), /desktopOnly=\{!isTabRoute\(pathname\)\}/);
});

test("business website navigation retains business selection and never offers Workspace", () => {
  const destinations = [];
  const module = { exports: {} };
  const compiled = ts.transpileModule(read("src/components/business/BusinessDesktopNavigation.tsx"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)((name) => name === "@tanstack/react-router" ? {
    Link: ({ to, search, children }) => {
      destinations.push({ to, search });
      return React.createElement("a", { href: to }, children);
    },
  } : require(name), module, module.exports);
  renderToStaticMarkup(React.createElement(module.exports.BusinessDesktopNavigation, { businessId: "selected" }));
  // /workspace redirects an owner onward, so a "Workspace" link would land the
  // user on Wallet and read as a broken button.
  assert.deepEqual(destinations, [
    { to: "/business", search: { businessId: "selected" } },
    { to: "/business/menu", search: { businessId: "selected" } },
    { to: "/wallet", search: {} },
  ]);
});

test("delayed auth events cannot redirect an open Workspace back to Wallet", () => {
  const { isAuthEntryPath } = navigationHelpers();
  assert.equal(isAuthEntryPath("/"), true);
  assert.equal(isAuthEntryPath("/auth"), true);
  for (const path of ["/workspace", "/business", "/wallet", "/profile"]) {
    assert.equal(isAuthEntryPath(path), false, path);
  }
  const root = read("src/routes/__root.tsx");
  assert.match(root, /if \(!isAuthEntryPath\(path\)\) return;/);
  assert.ok(root.indexOf("if (!isAuthEntryPath(path)) return;") < root.indexOf("sessionStorage.getItem"));
});

test("content adapts through layouts, not global font shrinking or oversized cards", () => {
  const wallet = read("src/routes/_authenticated/wallet.tsx");
  const css = read("src/styles.css");
  assert.match(wallet, /wallet-layout/);
  assert.match(wallet, /wallet-overview/);
  assert.match(wallet, /wallet-cards/);
  assert.match(wallet, /new ResizeObserver\(measure\)/);
  assert.match(wallet, /element.clientWidth \/ 1.586/);
  assert.match(wallet, /const CARD_H = cardHeight/);
  assert.match(wallet, /observer.disconnect\(\)/);
  assert.match(read("src/components/CustomerVouchers.tsx"), /md:grid-cols-2.*lg:grid-cols-3/);
  assert.match(read("src/routes/_authenticated/profile.tsx"), /profile-layout/);
  assert.match(css, /\.profile-primary \{\s*display: grid;/);
  assert.match(css, /\.profile-settings \{ display: grid;/);
  assert.match(css, /\.profile-page-qr \{ display: none;/);
  assert.match(read("src/routes/_authenticated/business.index.tsx"), /md:basis-1\/2 lg:basis-1\/3/);
  assert.match(read("src/routes/_authenticated/business.index.tsx"), /setSnapCount\(api.scrollSnapList\(\).length\)/);
  assert.match(read("src/routes/_authenticated/business.index.tsx"), /api.on\("reInit", syncCarousel\)/);
  assert.match(read("src/routes/_authenticated/business.index.tsx"), /snapCount > 1/);
  assert.match(read("src/routes/discover.tsx"), /group.businesses.slice\(0, 2\)/);
  assert.match(read("src/components/QrDisplay.tsx"), /h-full! w-full!/);
});
