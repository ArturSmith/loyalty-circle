// Exercise the real server handler with an in-memory streaming gateway.
// No credentials, external requests or AI credits are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/lib/card-usage.functions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const usageSource = readFileSync(new URL("../src/lib/card-usage.ts", import.meta.url), "utf8");
const usageModule = { exports: {} };
new Function("module", "exports", ts.transpileModule(usageSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(usageModule, usageModule.exports);
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
      : name === "@/lib/card-usage" ? usageModule.exports
      : require(name),
    module, module.exports, fetch, { env: { LOVABLE_API_KEY: apiKey } },
  );
  return module.exports.generateCardUsage;
}

test("server assembles a chunked AI stream into the instructions returned to the wizard", async () => {
  let calls = 0;
  const generate = server(async (url, options) => {
    calls += 1;
    assert.equal(url, "https://ai.gateway.lovable.dev/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.stream, true);
    assert.equal(body.model, "openai/gpt-5.6-sol");
    assert.match(body.input, /Test Café/);
    assert.match(body.input, /Coffee card/);
    const facts = JSON.parse(body.input.split("\n").at(-1));
    assert.deepEqual(facts.milestones, [{ step: 8, label: "Free coffee", stampsRequired: 7 }]);
    assert.match(body.input, /NOT terms and conditions/);
    assert.match(body.input, /Do not invent purchases/);
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
    instructions: "Collect stamps at the café. Redeem your voucher with staff.",
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

test("an empty completed stream is rejected instead of erasing the owner's instructions", async () => {
  const generate = server(async () => new Response('data: {"type":"response.completed"}\n\n'));
  await assert.rejects(generate({ data: input }), { message: "The AI returned an empty result. Please try again." });
});

test("invalid card input never reaches the paid gateway", async () => {
  const generate = server(async () => assert.fail("Invalid input must not call the gateway"));
  await assert.rejects(generate({ data: { ...input, totalSteps: 33 } }));
});

test("AI receives actual cumulative scan counts rather than reward-circle positions", async () => {
  const generate = server(async (_url, options) => {
    const facts = JSON.parse(JSON.parse(options.body).input.split("\n").at(-1));
    assert.deepEqual(facts.milestones.map((reward) => reward.stampsRequired), [7, 14, 21, 28]);
    assert.deepEqual(facts.milestones.map((reward) => reward.label), ["Coffee 8", "Coffee 16", "Coffee 24", "Coffee 32"]);
    return new Response('data: {"type":"response.output_text.delta","delta":"Show My QR in Wallet to staff."}\n\n');
  });
  await generate({ data: { ...input, totalSteps: 32, rewards: [8, 16, 24, 32].map((step) => ({ step, label: `Coffee ${step}` })) } });
});

test("zero-step cards and removed rewards cannot introduce fictitious reward milestones", async () => {
  const generate = server(async (_url, options) => {
    const facts = JSON.parse(JSON.parse(options.body).input.split("\n").at(-1));
    assert.deepEqual(facts.milestones, []);
    assert.equal(facts.totalSteps, 0);
    return new Response('data: {"type":"response.output_text.delta","delta":"This card has no stamp steps."}\n\n');
  });
  await generate({ data: { ...input, totalSteps: 0 } });
});

test("AI generation uses the existing authenticated server-function middleware", async () => {
  const generate = server(async () => assert.fail("Anonymous requests must not reach the gateway"), "test-key", false);
  await assert.rejects(generate({ data: input }), { message: "Unauthorized" });
});
