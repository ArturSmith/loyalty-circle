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
