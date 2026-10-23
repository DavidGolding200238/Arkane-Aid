// deno test --allow-read supabase/functions/_shared/ask_test.ts
// The whole sage request path with Groq mocked: what each persona actually sends to the model.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import type { ChatRequest } from "./groq.ts";
import { ask, type AskReply } from "./ask.ts";
import { IDENTITIES, PERSONAS, systemPrompt } from "./personas.ts";

async function run(body: Record<string, unknown>) {
  const sent: ChatRequest[] = [];
  const result = await ask(body, {
    chat: (request) => {
      sent.push(request);
      return Promise.resolve("Well met. What can I help with?");
    },
    party: () => Promise.resolve(""),
  });
  assertEquals(sent.length, 1);
  return { request: sent[0], result: result as AskReply };
}

// Exactly what the app sends for each Tome voice (src/lib/sage.ts), plus the old persona field.
const clients: [string, Record<string, unknown>][] = [
  ["wizard", { mode: "sage", style: "wizard" }],
  ["arbiter", { mode: "sage", style: "plain" }],
  ["bard", { mode: "bard", style: "plain" }],
  ["bard (wizard on the Tome before)", { mode: "bard", style: "wizard" }],
  ["scribe", { mode: "scribe", style: "wizard" }],
  ["old client persona wizard", { persona: "wizard" }],
];

for (const [name, voice] of clients) {
  for (const question of ["Hello", "hello!", "Hello Wizard", "Hi there", "thanks"]) {
    Deno.test(`${name}: "${question}" is small talk, with no spelling hint and no SRD search`, async () => {
      const { request, result } = await run({ question, sheet: "Level 3 Wizard", ...voice });
      const user = request.messages[1].content;
      assertStringIncludes(user, "<small_talk>");
      assertFalse(user.includes("<possible_corrections>"));
      assertFalse(user.includes("<srd>"));
      assertFalse(user.includes("<sheet>"));
      assertFalse(/hells/i.test(user + request.messages[0].content));
      assert(result.smallTalk);
      assertEquals(result.corrections, []);
      assertEquals(result.sources, []);
    });
  }
}

Deno.test("wizard: a real typo still searches the SRD and passes the fix as a guess", async () => {
  const { request, result } = await run({ question: "how much damage does firebal do", mode: "sage", style: "wizard" });
  assertStringIncludes(request.messages[1].content, '"firebal" might mean Fireball');
  assertFalse(result.smallTalk);
});

Deno.test("wizard, arbiter and bard get the same model, budget and SRD passages", async () => {
  const wizard = (await run({ question: "how does grappling work", mode: "sage", style: "wizard" })).request;
  const arbiter = (await run({ question: "how does grappling work", mode: "sage", style: "plain" })).request;
  const bard = (await run({ question: "how does grappling work", mode: "bard" })).request;
  for (const other of [arbiter, bard]) {
    assertEquals(other.model, wizard.model);
    assertEquals(other.maxTokens, wizard.maxTokens);
    assertEquals(other.messages[1].content, wizard.messages[1].content);
  }
  assertEquals(PERSONAS.sage.srdLimit, PERSONAS.bard.srdLimit);
  assertEquals(PERSONAS.sage.srdLimit, 4);
});

Deno.test("wizard, arbiter and bard prompts differ only in the identity block", () => {
  const prompts = { wizard: systemPrompt("sage", "wizard"), plain: systemPrompt("sage", "plain"), bard: systemPrompt("bard") };
  const base = prompts.wizard.replace(IDENTITIES.wizard, "");
  for (const flavour of ["plain", "bard"] as const) {
    assert(prompts[flavour].endsWith(IDENTITIES[flavour]));
    assertEquals(prompts[flavour].replace(IDENTITIES[flavour], ""), base);
  }
  assertStringIncludes(base, '"Lore:" or "Homebrew idea:"');
  assertStringIncludes(base, "When greeted");
  assertStringIncludes(base, "the answer comes first");
  assertFalse(/Alex|Jack/.test(base));
});

Deno.test("the scribe keeps its ledger voice", () => {
  assertStringIncludes(systemPrompt("scribe"), "Write it as ONE ledger line");
});
