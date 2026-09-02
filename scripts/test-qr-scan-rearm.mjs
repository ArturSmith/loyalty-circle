// Run with: node --test scripts/test-qr-scan-rearm.mjs
// Exercise the real scanner effect with a fake camera, without timers or hardware.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL("../src/components/QrScanner.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness({ deferred = false } = {}) {
  const refs = [], cameras = [], received = [];
  let cursor = 0, effect, cleanup;
  const stubs = {
    react: {
      useRef: (initial) => refs[cursor++] ?? (refs[cursor - 1] = { current: initial }),
      useState: () => [null, () => {}],
      useEffect: (fn) => { effect = fn; },
    },
    "@zxing/browser": { BrowserMultiFormatReader: class {
      decodeFromVideoDevice(_id, _video, callback) {
        const camera = { callback, stopped: false };
        const controls = { stop: () => { camera.stopped = true; } };
        cameras.push(camera);
        if (deferred) return new Promise((resolve) => { camera.resolve = () => resolve(controls); });
        return Promise.resolve(controls);
      }
    } },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", source)((name) => stubs[name] ?? require(name), module, module.exports);
  return {
    cameras, received,
    render(paused) {
      cleanup?.(); cursor = 0;
      module.exports.QrScanner({ paused, onScan: (text) => received.push(text) });
      cleanup = effect();
    },
    scan(index = cameras.length - 1) { cameras[index].callback({ getText: () => "stempel:card:test" }); },
    unmount() { cleanup?.(); },
  };
}

test("same frame is ignored, but Scan next immediately accepts the same QR", (t) => {
  t.mock.method(Date, "now", () => 1000); // No time passes between scans.
  const h = harness();
  h.render(false); h.scan(); h.scan();
  assert.equal(h.received.length, 1);
  h.render(true); h.render(false); h.scan();
  assert.equal(h.received.length, 2);
  h.unmount();
});
test("late camera frames after pause cannot add another stamp", () => {
  const h = harness();
  h.render(false); h.scan(); h.render(true); h.scan(0);
  assert.equal(h.received.length, 1);
});
test("a camera that finishes starting after unmount is stopped", async () => {
  const h = harness({ deferred: true });
  h.render(false); h.unmount(); h.cameras[0].resolve();
  await Promise.resolve();
  assert.equal(h.cameras[0].stopped, true);
  h.scan(0);
  assert.equal(h.received.length, 0);
});
