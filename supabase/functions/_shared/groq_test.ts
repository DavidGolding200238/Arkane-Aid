// deno test supabase/functions/_shared/groq_test.ts
// fetch is faked: which model answers when the big one is busy, and when the fallback is off.
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { type ChatRequest, chatWithModel, GroqError } from "./groq.ts";

const request: ChatRequest = {
  model: "openai/gpt-oss-120b",
  temperature: 0.3,
  maxTokens: 100,
  messages: [{ role: "user", content: "hi" }],
};

function fakeFetch(statusFor: (model: string) => number, models: string[]) {
  globalThis.fetch = ((_url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model as string;
    models.push(model);
    const status = statusFor(model);
    const body = status === 200
      ? { choices: [{ message: { content: `from ${model}` } }] }
      : { error: { message: "busy" } };
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as typeof fetch;
}

const realFetch = globalThis.fetch;

Deno.test("the big model answers: its name comes back with the text", async () => {
  const models: string[] = [];
  fakeFetch(() => 200, models);
  try {
    assertEquals(await chatWithModel("k", request), { text: "from openai/gpt-oss-120b", model: "openai/gpt-oss-120b" });
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("big model rate-limited: the small one answers and is named", async () => {
  const models: string[] = [];
  fakeFetch((m) => (m.endsWith("120b") ? 429 : 200), models);
  try {
    assertEquals((await chatWithModel("k", request)).model, "openai/gpt-oss-20b");
    assertEquals(models, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("fallback off: a busy big model throws and the small one is never asked", async () => {
  const models: string[] = [];
  fakeFetch(() => 503, models);
  try {
    const error = await assertRejects(() => chatWithModel("k", { ...request, fallback: false }), GroqError);
    assertEquals(error.status, 503);
    assertEquals(models, ["openai/gpt-oss-120b"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
