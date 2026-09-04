import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, stubs, append = '') {
  const source = ts.transpileModule(read(path) + append, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
}

for (const [label, response, expected] of [
  ['used card', { data: true, error: null }, false],
  ['unused card', { data: false, error: null }, true],
  ['RPC error', { data: null, error: new Error('Unavailable') }, null],
  ['missing result', { data: null, error: null }, null],
]) {
  test(`editability is permission-scoped and fails closed: ${label}`, async () => {
    let state = null, effect;
    const calls = [];
    const { useCardEditability } = load('src/hooks/useCardEditability.ts', {
      react: { useState: () => [state, (value) => { state = value; }], useEffect: (fn) => { effect = fn; } },
      '@/integrations/supabase/client': { supabase: { rpc: async (...args) => { calls.push(args); return response; } } },
    });
    assert.equal(useCardEditability('card-a').canEdit, null);
    const cleanup = effect();
    await new Promise(setImmediate);
    const result = useCardEditability('card-a');
    assert.equal(result.canEdit, expected);
    assert.equal(Boolean(result.error), expected === null);
    assert.deepEqual(calls, [['card_has_customers', { _template_id: 'card-a' }]]);
    assert.equal(useCardEditability('card-b').canEdit, null, 'Old business/card status must not authorize a different card');
    assert.equal(useCardEditability('card-a', false).canEdit, null, 'Revoked permissions cannot reuse a cached allowance');
    cleanup();
  });
}

for (const [label, status, allowed] of [
  ['unused', { canEdit: true, error: null }, true],
  ['used', { canEdit: false, error: null }, false],
  ['loading', { canEdit: null, error: null }, false],
  ['failed', { canEdit: null, error: 'Cannot check card' }, false],
]) {
  test(`direct edit URL only mounts wizard after confirmed permission: ${label}`, () => {
    const Wizard = () => null;
    const { EditableCard } = load('src/routes/_authenticated/business.cards.$id.edit.tsx', {
      '@tanstack/react-router': { createFileRoute: () => (options) => options, Link: () => null },
      '@/components/CardWizard': { CardWizard: Wizard },
      '@/components/business/BusinessPermissionGate': { BusinessPermissionGate: () => null },
      '@/hooks/useCardEditability': { useCardEditability: () => status, CARD_IN_USE_MESSAGE: 'Used cards cannot be edited' },
      '@/components/Spinner': { ScreenLoader: () => null },
      '@/components/ui/button': { Button: () => null },
    }, '\nexport { EditableCard };');
    const tree = EditableCard({ id: 'card-a', businessId: 'business-a' });
    assert.ok(React.isValidElement(tree));
    assert.equal(tree.type === Wizard, allowed);
  });
}

test('card detail edit link and submission copy reflect edit restrictions', () => {
  assert.match(read('src/routes/_authenticated/business.cards.$id.index.tsx'), /permissions\.has\("cards.manage"\) && editability\.canEdit === true/);
  assert.match(read('src/components/CardWizard.tsx'), /hidden from Discover until approved/);
});
