// Local mocks only: no messages are sent to the support inbox.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, stubs = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
}

function server(send) {
  return load('src/lib/contact.functions.ts', {
    '@tanstack/react-start': { createServerFn: ({ method }) => {
      assert.equal(method, 'POST');
      return { inputValidator: (validate) => ({ handler: (handler) => ({ data }) => handler({ data: validate(data) }) }) };
    } },
    '@/lib/email-templates/send-email': { sendTemplateEmail: send },
  }).sendContactMessage;
}

const input = { name: ' Jane ', email: 'jane@example.com', message: ' Hello support ', submissionId: '97ebea25-cbc4-48b9-afb3-333a19a287d8' };
test('contact sends validated data to the fixed support inbox with reply-to and a per-submission retry key', async () => {
  const calls = [];
  const send = server(async (...args) => { calls.push(args); return { sent: true }; });
  await send({ data: { ...input, to: 'untrusted@example.com' } });
  await send({ data: input });
  await send({ data: { ...input, submissionId: '97ebea25-cbc4-48b9-afb3-333a19a287d9' } });
  assert.deepEqual(calls[0], ['contact-message', 'support@clubcarder.com', {
    templateData: { name: 'Jane', email: input.email, message: 'Hello support' },
    replyTo: input.email, idempotencyKey: `contact-${input.submissionId}`,
  }]);
  assert.equal(calls[0][2].idempotencyKey, calls[1][2].idempotencyKey);
  assert.notEqual(calls[1][2].idempotencyKey, calls[2][2].idempotencyKey);
});

test('invalid contact input never reaches the email provider', () => {
  const send = server(() => assert.fail('Unexpected email'));
  for (const change of [{ email: 'invalid' }, { message: 'no' }, { name: ' ' }, { submissionId: 'invalid' }]) {
    assert.throws(() => send({ data: { ...input, ...change } }));
  }
});

function find(tree, predicate) {
  if (!React.isValidElement(tree)) return;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

function formHarness(send) {
  const hooks = [], errors = [], calls = [];
  let cursor = 0, tree;
  const component = load('src/routes/contact.tsx', {
    react: { ...React,
      useState: (initial) => {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = initial;
        return [hooks[index], (value) => { hooks[index] = value; }];
      },
      useRef: (initial) => {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = { current: initial };
        return hooks[index];
      },
    },
    '@tanstack/react-router': { createFileRoute: () => (options) => options, Link: () => null },
    '@tanstack/react-start': { useServerFn: (fn) => fn },
    '@/lib/contact.functions': { sendContactMessage: async (request) => { calls.push(request); return send(request); } },
    '@/components/Logo': { Logo: () => null },
    '@/components/ui/button': { Button: () => null },
    '@/components/ui/input': { Input: () => null },
    '@/components/ui/label': { Label: () => null },
    '@/components/ui/textarea': { Textarea: () => null },
    sonner: { toast: { error: (message) => errors.push(message) } },
  }).Route.component;
  const render = () => { cursor = 0; tree = component(); };
  const field = (id) => find(tree, (element) => element.props.id === id);
  render();
  for (const [id, value] of Object.entries({ name: 'Jane', email: input.email, message: 'Hello support' })) {
    field(id).props.onChange({ target: { value } });
  }
  render();
  return {
    calls, errors, render, field,
    submit: () => find(tree, (element) => element.type === 'form').props.onSubmit({ preventDefault() {} }),
    sending: () => find(tree, (element) => element.type === 'fieldset').props.disabled,
    success: () => find(tree, (element) => element.props.role === 'status'),
  };
}

test('form sends directly, blocks duplicate clicks and only clears the message after confirmed success', async () => {
  let resolve;
  const form = formHarness(() => new Promise((done) => { resolve = done; }));
  const pending = form.submit();
  await form.submit();
  form.render();
  assert.equal(form.calls.length, 1);
  assert.equal(form.sending(), true);
  assert.equal(form.field('message').props.value, 'Hello support');
  resolve({ sent: true });
  await pending;
  form.render();
  assert.equal(form.sending(), false);
  assert.equal(form.field('message').props.value, '');
  assert.ok(form.success());
  assert.deepEqual(form.errors, []);
});

for (const outcome of ['failed', 'suppressed']) {
  test(`${outcome} sends preserve the message and reuse the same retry ID`, async () => {
    const form = formHarness(async () => {
      if (outcome === 'failed') throw new Error('Provider unavailable');
      return { sent: false, reason: 'recipient_suppressed' };
    });
    await form.submit();
    form.render();
    assert.equal(form.field('message').props.value, 'Hello support');
    assert.equal(form.sending(), false);
    assert.equal(form.success(), undefined);
    await form.submit();
    assert.equal(form.calls[0].data.submissionId, form.calls[1].data.submissionId);
    assert.equal(form.errors.length, 2);
    form.field('message').props.onChange({ target: { value: 'A different support question' } });
    form.render();
    await form.submit();
    assert.notEqual(form.calls[1].data.submissionId, form.calls[2].data.submissionId);
  });
}
