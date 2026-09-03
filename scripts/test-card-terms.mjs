// Exercise the real server handler with an in-memory streaming gateway.
// No credentials, external requests or AI credits are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/card-terms.functions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const input = {
  businessName: "Test Café",
  title: "Coffee card",
  subtitle: "Each eighth coffee is free",
  totalSteps: 8,
  rewards: [{ step: 8, label: "Free coffee" }],
};

function server(fetch, apiKey = "test-key-not-a-credential", authenticated = true) {
  const module = { exports: {} };
  const requireSupabaseAuth = Symbol("requireSupabaseAuth");
  const start = {
    createServerFn: ({ method }) => {
      assert.equal(method, "POST");
      return { middleware: (middleware) => {
        assert.deepEqual(middleware, [requireSupabaseAuth]);
        return { inputValidator: (validate) => ({
          handler: (handle) => async ({ data }) => {
            if (!authenticated) throw new Error("Unauthorized");
            return handle({ data: validate(data) });
          },
        }) };
      } };
    },
  };
  new Function("require", "module", "exports", "fetch", "process", compiled)(
    (name) => name === "@tanstack/react-start" ? start
      : name === "@/integrations/supabase/auth-middleware" ? { requireSupabaseAuth }
      : require(name),
    module, module.exports, fetch, { env: { LOVABLE_API_KEY: apiKey } },
  );
  return module.exports.generateCardTerms;
}

test("server assembles a chunked AI stream into the terms returned to the wizard", async () => {
  let calls = 0;
  const generate = server(async (url, options) => {
    calls += 1;
    assert.equal(url, "https://ai.gateway.lovable.dev/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.stream, true);
    assert.equal(body.model, "openai/gpt-5.6-sol");
    assert.match(body.input, /Test Café/);
    assert.match(body.input, /Coffee card/);
    assert.match(body.input, /step 8: "Free coffee"/);
    const bytes = new TextEncoder().encode([
      'data: {"type":"response.output_text.delta","delta":"Collect stamps at the café. "}\n\n',
      'data: {"type":"response.output_text.delta","delta":"Redeem your voucher with staff."}\n\n',
      'data: {"type":"response.completed"}\n\n',
      'data: [DONE]\n\n',
    ].join(""));
    return new Response(new ReadableStream({ start(controller) {
      // Split SSE frames and multibyte text across network chunks.
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    } }));
  });
  assert.deepEqual(await generate({ data: input }), {
    terms: "Collect stamps at the café. Redeem your voucher with staff.",
  });
  assert.equal(calls, 1);
});

for (const [status, message] of [
  [429, "AI is busy right now. Please try again in a moment."],
  [402, "AI credits are exhausted for this workspace."],
]) {
  test(`gateway HTTP ${status} becomes the readable error displayed by the wizard`, async () => {
    const generate = server(async () => new Response("Gateway error", { status }));
    await assert.rejects(generate({ data: input }), { message });
  });
}

test("missing gateway configuration fails clearly before making an external request", async () => {
  const generate = server(async () => assert.fail("Must not call an unconfigured gateway"), "");
  await assert.rejects(generate({ data: input }), { message: "AI is not configured for this project." });
});

test("an empty completed stream is rejected instead of erasing the owner's terms", async () => {
  const generate = server(async () => new Response('data: {"type":"response.completed"}\n\n'));
  await assert.rejects(generate({ data: input }), { message: "The AI returned an empty result. Please try again." });
});

test("invalid card input never reaches the paid gateway", async () => {
  const generate = server(async () => assert.fail("Invalid input must not call the gateway"));
  await assert.rejects(generate({ data: { ...input, totalSteps: 33 } }));
});

test("AI generation uses the existing authenticated server-function middleware", async () => {
  const generate = server(async () => assert.fail("Anonymous requests must not reach the gateway"), "test-key", false);
  await assert.rejects(generate({ data: input }), { message: "Unauthorized" });
});
