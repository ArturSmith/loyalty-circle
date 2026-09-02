// Run with: node --test scripts/test-card-steps-badge.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(
  readFileSync(new URL("../src/components/DiscoverCardTile.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
);
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputText)(
  (name) => {
    if (name === "@tanstack/react-router") return { Link: "a" };
    if (name === "@/lib/discover") return { formatDistance: () => null };
    return require(name);
  },
  module,
  module.exports,
);

function findBadge(node, ancestors = []) {
  if (!React.isValidElement(node)) return null;
  if (node.type === "span" && React.Children.toArray(node.props.children).includes(" steps")) {
    return { badge: node, ancestors };
  }
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findBadge(child, [...ancestors, node]);
    if (found) return found;
  }
  return null;
}

for (const compact of [true, false]) {
  for (const [bg_color, text_color] of [["#77bd3b", "#ffffff"], ["#191919", "#f5d780"], ["#ffffff", "#000000"]]) {
    test(`steps badge stays opaque black-on-gray for ${bg_color}, compact=${compact}`, () => {
      const tree = module.exports.DiscoverCardTile({
        compact,
        card: {
          business_id: "business-id", title: "Mama Card", business_name: "MamaMia",
          total_steps: 10, city: "Rome", distance_km: null, business_logo_url: null,
          bg_color, text_color, accent_color: "#ffffff",
        },
      });
      const { badge, ancestors } = findBadge(tree);
      assert.ok(badge.props.className.includes("text-black"));
      assert.ok(badge.props.className.includes("bg-[#e8ecf1]"));
      assert.deepEqual(React.Children.toArray(badge.props.children), [10, " steps"]);
      for (const element of [...ancestors, badge]) {
        assert.doesNotMatch(element.props.className ?? "", /(?:^|\s)opacity-/);
        assert.equal(element.props.style?.opacity, undefined);
      }
      assert.equal(tree.props.params.businessId, "business-id");
    });
  }
}
