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
      assertStringIncludes(user, "<chat>");
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
  assertStringIncludes(base, "Greet only when greeted");
  assertStringIncludes(base, "Manner: a warm, kind companion");
  assertStringIncludes(base, "never errors");
  assertStringIncludes(base, "can't go above 20");
  assertStringIncludes(base, "Source: Alignment, p. 21");
  assertStringIncludes(base, "the answer comes first");
  assertFalse(/Alex|Jack/.test(base));
});

Deno.test("the scribe keeps its ledger voice", () => {
  assertStringIncludes(systemPrompt("scribe"), "Write it as ONE ledger line");
});

// Short memory: the last exchanges of this Sage session ride along as chat turns.
async function runWith(body: Record<string, unknown>, semantic?: (text: string) => Promise<never[]>) {
  const sent: ChatRequest[] = [];
  const searched: string[] = [];
  const result = await ask(body, {
    chat: (request) => {
      sent.push(request);
      return Promise.resolve("It lasts 10 minutes.");
    },
    party: () => Promise.resolve(""),
    semantic: semantic ?? ((text) => {
      searched.push(text);
      return Promise.resolve([]);
    }),
  });
  return { request: sent[0], result: result as AskReply, searched };
}

const rage = [{ q: "how does a barbarian's rage work", a: "As a bonus action you enter a Rage..." }];

for (const [name, voice] of clients.filter(([n]) => !n.startsWith("scribe"))) {
  Deno.test(`${name}: earlier exchanges are sent before the new question`, async () => {
    const { request } = await runWith({ question: "how long does it last?", history: rage, ...voice });
    assertEquals(request.messages.length, 4);
    assertEquals(request.messages[1], { role: "user", content: `Question: ${rage[0].q}` });
    assertEquals(request.messages[2].role, "assistant");
    assertStringIncludes(request.messages[3].content, "how long does it last?");
  });
}

Deno.test("scribe: no memory", async () => {
  const { request } = await runWith({ question: "Notes: we fought goblins", mode: "scribe", history: rage });
  assertEquals(request.messages.length, 2);
});

Deno.test("small talk: keeps the memory but skips the search", async () => {
  const { request, searched, result } = await runWith({ question: "thanks!", mode: "sage", history: rage });
  assertEquals(request.messages.length, 4);
  assertEquals(searched, []);
  assertEquals(result.retrieval, "none");
  assertEquals(result.chat, "thanks");
});

Deno.test("a follow-up searches with the previous question too", async () => {
  const { searched, result } = await runWith({ question: "how long does it last?", mode: "sage", history: rage });
  assertEquals(searched, [`how long does it last? ${rage[0].q}`]);
  assert(result.sources.some((s) => s.title.includes("Rage")));
  assertEquals(result.retrieval, "keyword");
});

Deno.test("a fresh question does not borrow the previous one", async () => {
  const { searched } = await runWith({ question: "how does grappling work", mode: "sage", history: rage });
  assertEquals(searched, ["how does grappling work"]);
});

Deno.test("meaning search failing still answers from keyword search", async () => {
  const { result } = await runWith({ question: "how does grappling work", mode: "sage" }, () => Promise.reject(new Error("down")));
  assertEquals(result.retrieval, "keyword");
  assert(result.sources.length > 0);
});

// ---- Chat, tone and sources: the same for the Wizard, the Arbiter and the Bard ----

const SAGE_VOICES = clients.filter(([n]) => ["wizard", "arbiter", "bard"].includes(n));
const sheetRuling = [{ q: "Check my playersheet and tell me whats wrong", a: "Thy Strength of 30 is above the 20 a player character may have. Lower it to 20 or less." }];

async function runReply(body: Record<string, unknown>, modelReply: string) {
  const sent: ChatRequest[] = [];
  const searched: string[] = [];
  const result = await ask(body, {
    chat: (request) => {
      sent.push(request);
      return Promise.resolve(modelReply);
    },
    party: () => Promise.resolve(""),
    semantic: (text) => {
      searched.push(text);
      return Promise.resolve([]);
    },
  });
  return { request: sent[0], result: result as AskReply, searched };
}

for (const [name, voice] of SAGE_VOICES) {
  for (const question of ["Damn", "damn!", "wow", "ok", "lol", "hmm", "nice", "ugh", "oh no", "fuck", "damn ok"]) {
    Deno.test(`${name}: "${question}" after a ruling is chat with memory, not a greeting`, async () => {
      const { request, result, searched } = await runReply({ question, history: sheetRuling, ...voice }, "Aye, harsh news.");
      assertEquals(searched, []);
      assertEquals(request.messages.length, 4);
      assertEquals(request.messages[2].content, sheetRuling[0].a);
      const user = request.messages[3].content;
      assertStringIncludes(user, "<chat>");
      assertStringIncludes(user, "following on from what was just said");
      assertStringIncludes(user, "Do not greet");
      assertFalse(user.includes("Greet back"));
      assertFalse(user.includes("<srd>"));
      assertEquals(result.chat, "chat");
      assert(result.smallTalk);
    });
  }

  Deno.test(`${name}: "Damn" with no history still does not greet`, async () => {
    const { request } = await runReply({ question: "Damn", ...voice }, "Aye?");
    assertEquals(request.messages.length, 2);
    assertStringIncludes(request.messages[1].content, "Do not greet");
  });

  Deno.test(`${name}: "Hello" mid-conversation carries on instead of starting over`, async () => {
    const { request, result } = await runReply({ question: "Hello", history: sheetRuling, ...voice }, "Hello again.");
    assertEquals(request.messages.length, 4);
    assertStringIncludes(request.messages[3].content, "do not start over");
    assertEquals(result.chat, "greeting");
  });

  Deno.test(`${name}: citations are split out of the spoken reply`, async () => {
    const model = "Thy sheet lacks an alignment. Strength 30 is too high for a player character. " +
      "(SRD: Creation > Create Your Character > Step 4: Alignment, p. 21; SRD: Creation > Create Your Character > Step 3: Ability Scores > Adjust Ability Scores, p. 21)";
    const { result } = await runReply({ question: "how does alignment work", ...voice }, model);
    assertFalse(/SRD|p\. ?\d|>/.test(result.reply), result.reply);
    assertEquals(result.reply, "Thy sheet lacks an alignment. Strength 30 is too high for a player character.");
    assertEquals(result.source, "Alignment, p. 21; Adjust Ability Scores, p. 21");
  });

  Deno.test(`${name}: a Source line is moved to the footer`, async () => {
    const { result } = await runReply({ question: "how much damage does fireball do", ...voice }, "Fireball deals 8d6 Fire damage.\nSource: Fireball, p. 131");
    assertEquals(result.reply, "Fireball deals 8d6 Fire damage.");
    assertEquals(result.source, "Fireball, p. 131");
  });

  Deno.test(`${name}: chat never gets a source footer`, async () => {
    const { result } = await runReply({ question: "thanks", ...voice }, "My pleasure. Source: Fireball, p. 131");
    assertEquals(result.source, "");
    assertEquals(result.reply, "My pleasure.");
  });

  Deno.test(`${name}: a sheet review searches the creation rules and asks for a kind review`, async () => {
    const { request, result } = await runReply(
      { question: "Check my playersheet and tell me whats wrong", sheet: "Brakka Human Fighter L1\nSTR30 DEX12 CON14 INT8 WIS10 CHA10", ...voice },
      "Mostly fine.",
    );
    const user = request.messages[1].content;
    assertStringIncludes(user, "<sheet_review>");
    assertStringIncludes(user, "how to fix it");
    assertStringIncludes(user, "[Adjust Ability Scores, p. 21]");
    assert(result.sources.some((s) => s.title === "Adjust Ability Scores"));
  });
}

Deno.test("wizard, arbiter and bard send the same chat and sheet-review messages", async () => {
  const sheet = { question: "Check my playersheet and tell me whats wrong", sheet: "STR30" };
  const chat = { question: "Damn", history: sheetRuling };
  for (const body of [sheet, chat]) {
    const sent = await Promise.all(SAGE_VOICES.map(([, v]) => runReply({ ...body, ...v }, "ok")));
    for (const other of sent.slice(1)) {
      assertEquals(other.request.messages.slice(1), sent[0].request.messages.slice(1));
      assertEquals(other.request.maxTokens, sent[0].request.maxTokens);
    }
  }
});

// David's scope rule: anything D&D or campaign gets a real answer, anything else a kind
// one-line "outside my tome" and a nudge back. The rule is shared, so every voice gets it.
const OUT_OF_SCOPE = [
  "how do I reverse a string in python",
  "solve 3x + 5 = 20 for my maths homework",
  "who won the football last night",
];
const ODD_BUT_IN_SCOPE = [
  "my rogue tries to seduce a dragon mid-fall, what happens?",
  "how would a medieval town handle taxes for my campaign",
];

Deno.test("the scope rule is in every voice and is word for word the same", () => {
  const scopes = SAGE_VOICES.map(([, v]) => {
    const prompt = systemPrompt(v.mode as "sage" | "bard", v.style as "plain" | "wizard");
    return prompt.split("\n\n").find((part) => part.startsWith("Scope:"));
  });
  for (const scope of scopes) {
    assert(scope);
    assertStringIncludes(scope, "always get a real, helpful answer, never a refusal");
    assertStringIncludes(scope, "coding, maths, sport, trivia, essays");
    assertStringIncludes(scope, "answer none of it, not even a hint");
    assertStringIncludes(scope, "outside your tome");
    assertStringIncludes(scope, "If it could belong in a campaign, it is in scope");
    assertEquals(scope, scopes[0]);
    assert(scope.length < 520, `scope rule is ${scope.length} chars`);
  }
  for (const [, v] of SAGE_VOICES) {
    assertFalse(systemPrompt(v.mode as "sage" | "bard", v.style as "plain" | "wizard").includes("steer back"));
  }
});

for (const [name, voice] of SAGE_VOICES) {
  for (const question of OUT_OF_SCOPE) {
    Deno.test(`${name}: "${question}" is not chat and is sent under the scope rule`, async () => {
      const decline = "That lies outside my tome, friend. Shall we get back to the game?";
      const { request, result } = await runReply({ question, ...voice }, decline);
      assertEquals(result.chat, null);
      assertFalse(result.smallTalk);
      assertStringIncludes(request.messages[0].content, "answer none of it, not even a hint");
      assertEquals(result.reply, decline);
      assertEquals(result.source, "");
    });
  }
  for (const question of ODD_BUT_IN_SCOPE) {
    Deno.test(`${name}: "${question}" is a real question: searched and answered`, async () => {
      const { request, result, searched } = await runReply({ question, ...voice }, "Roll Charisma.\nSource: Falling, p. 179");
      assertEquals(result.chat, null);
      assert(searched.length > 0);
      assertStringIncludes(request.messages[request.messages.length - 1].content, "<srd>");
      assertStringIncludes(request.messages[0].content, "never a refusal");
      assertEquals(result.reply, "Roll Charisma.");
    });
  }
}

Deno.test("out-of-scope and odd questions reach all three voices as the same message", async () => {
  for (const question of [...OUT_OF_SCOPE, ...ODD_BUT_IN_SCOPE]) {
    const sent = await Promise.all(SAGE_VOICES.map(([, v]) => runReply({ question, ...v }, "ok")));
    for (const other of sent.slice(1)) {
      assertEquals(other.request.messages.slice(1), sent[0].request.messages.slice(1));
      assertEquals(other.request.maxTokens, sent[0].request.maxTokens);
    }
  }
});
