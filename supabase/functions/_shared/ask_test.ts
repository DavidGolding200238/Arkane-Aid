// deno test --allow-read supabase/functions/_shared/ask_test.ts
// The whole sage request path with Groq mocked: what each persona actually sends to the model.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import type { ChatRequest } from "./groq.ts";
import { ask, type AskReply } from "./ask.ts";
import { IDENTITIES, PERSONAS, REVIEW_VOICE, systemPrompt, temperatureFor, voiceReminder } from "./personas.ts";

/** The last user message without the voice reminder, which is the one part that differs by voice. */
const unvoiced = (content: string) => content.replace(/\n\n<voice>[^]*<\/voice>$/, "");

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
    assertEquals(unvoiced(other.messages[1].content), unvoiced(wizard.messages[1].content));
  }
  assertEquals(PERSONAS.sage.srdLimit, PERSONAS.bard.srdLimit);
  assertEquals(PERSONAS.sage.srdLimit, 4);
});

Deno.test("wizard, arbiter and bard prompts differ only in the identity block", () => {
  const prompts = {
    wizard: systemPrompt("sage", "wizard"),
    plain: systemPrompt("sage", "plain"),
    bard: systemPrompt("bard"),
  };
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
  assertFalse(/creature|monster/i.test(base));
  assertStringIncludes(base, "Never use help-desk lines");
  assertFalse(base.includes("then offer to help"));
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
  const { result } = await runWith(
    { question: "how does grappling work", mode: "sage" },
    () => Promise.reject(new Error("down")),
  );
  assertEquals(result.retrieval, "keyword");
  assert(result.sources.length > 0);
});

// ---- Chat, tone and sources: the same for the Wizard, the Arbiter and the Bard ----

const SAGE_VOICES = clients.filter(([n]) => ["wizard", "arbiter", "bard"].includes(n));
// David's sheet, exactly as the app sends it (SageScreen): STR 30, Traits "Yes", Features "Lol", Gear "Lol".
const DAVID = {
  name: "David",
  race: "Human",
  class: "Bard",
  level: 1,
  hp_current: 9,
  hp_max: 9,
  ac: 12,
  speed: 30,
  str: 30,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
  skills: "",
  languages: "Common",
  features: "Lol",
  traits: ["Yes"],
  gear: ["Lol"],
};
const CLEAN = {
  ...DAVID,
  str: 8,
  dex: 14,
  con: 12,
  int: 10,
  wis: 13,
  cha: 15,
  features: "Bardic Inspiration, Spellcasting",
  traits: ["Resourceful", "Skillful", "Versatile"],
  gear: ["Lute", "Leather Armor", "Dagger"],
};
const sheetRuling = [{
  q: "Check my playersheet and tell me whats wrong",
  a: "Thy Strength of 30 is above the 20 a player character may have. Lower it to 20 or less.",
}];

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
      const { request, result, searched } = await runReply(
        { question, history: sheetRuling, ...voice },
        "Aye, harsh news.",
      );
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
    // Only extracts the model was actually given make the footer.
    assertEquals(result.source, "Alignment, p. 21");
  });

  Deno.test(`${name}: no Source line still gets a footer when the reply uses a passage`, async () => {
    const { result } = await runReply(
      { question: "how much damage does fireball do", ...voice },
      "Fireball deals 8d6 Fire damage in a 20-foot sphere.",
    );
    assertEquals(result.source, "Fireball, p. 131");
  });

  Deno.test(`${name}: a made-up Source is dropped`, async () => {
    const { result } = await runReply(
      { question: "how much damage does fireball do", ...voice },
      "It deals 8d6.\nSource: Dragon Magic, p. 999",
    );
    assertEquals(result.reply, "It deals 8d6.");
    assertEquals(result.source, "");
  });

  Deno.test(`${name}: out-of-scope declines get no footer even if the model adds one`, async () => {
    const { result } = await runReply(
      { question: "who won the football last night", ...voice },
      "That lies outside my tome.\nSource: Fireball, p. 131",
    );
    assertEquals(result.reply, "That lies outside my tome.");
    assertEquals(result.source, "");
  });

  Deno.test(`${name}: the voice reminder is the very last thing the model reads`, async () => {
    for (
      const body of [{ question: "how does grappling work" }, { question: "Damn", history: sheetRuling }, {
        question: "what do you think of my sheet",
        character: DAVID,
      }]
    ) {
      const { request, result } = await runReply({ ...body, ...voice }, "ok");
      const last = request.messages[request.messages.length - 1];
      assertEquals(last.role, "user");
      const review = result.retrieval === "sheet";
      const reminder = voiceReminder(voice.mode as "sage" | "bard", voice.style as "plain" | "wizard", review);
      assert(last.content.endsWith(reminder), last.content.slice(-200));
      // Sheet reviews get the extra "never a checklist" line; other answers stay lean.
      assertEquals(reminder.includes(REVIEW_VOICE), review);
      assertStringIncludes(reminder, "let me know if");
      assertStringIncludes(reminder, "an offer in your own voice is fine");
    }
  });

  Deno.test(`${name}: help-desk closers are trimmed from the reply`, async () => {
    const { result } = await runReply(
      { question: "how does grappling work", ...voice },
      "Make an Unarmed Strike to grapple. Let me know if there's anything else I can help with!",
    );
    assertEquals(result.reply, "Make an Unarmed Strike to grapple.");
  });

  Deno.test(`${name}: a Source line is moved to the footer`, async () => {
    const { result } = await runReply(
      { question: "how much damage does fireball do", ...voice },
      "Fireball deals 8d6 Fire damage.\nSource: Fireball, p. 131",
    );
    assertEquals(result.reply, "Fireball deals 8d6 Fire damage.");
    assertEquals(result.source, "Fireball, p. 131");
  });

  Deno.test(`${name}: chat never gets a source footer`, async () => {
    const { result } = await runReply({ question: "thanks", ...voice }, "My pleasure. Source: Fireball, p. 131");
    assertEquals(result.source, "");
    assertEquals(result.reply, "My pleasure.");
  });

  Deno.test(`${name}: David's sheet review sends only the checker's findings, no SRD`, async () => {
    const { request, result, searched } = await runReply(
      { question: "What you think of my chatacter sheet", sheet: "old brief", character: DAVID, ...voice },
      "Thy Strength of 30 is beyond any mortal hero.\nSource: Ability Scores, p. 255",
    );
    assertEquals(searched, []);
    assertEquals(request.messages.length, 2);
    const user = request.messages[1].content;
    assertFalse(user.includes("<srd>"));
    assertStringIncludes(user, "<findings>");
    // A data table with neutral kinds, so there is no "Fix:" checklist to copy.
    assertStringIncludes(user, "kind | field | what is off | remedy");
    assertStringIncludes(user, "must change | Strength | Strength is 30");
    assertStringIncludes(user, "must change | Traits |");
    assertStringIncludes(user, "must change | Gear |");
    assertStringIncludes(user, "must change | Features |");
    assertStringIncludes(user, "optional | Ability Scores | Charisma");
    assertFalse(/\bFix\b|Suggestion \(/.test(user.split("<sheet_review>")[0]), "no label words in the findings");
    assertStringIncludes(user, "Write ONE short flowing reply in your voice");
    assertStringIncludes(user, "Sentences only, no list.");
    assertStringIncludes(user, 'No "Fix:" or "Suggestion:" labels');
    assertStringIncludes(
      user,
      "Only mention the findings listed; never call anything else wrong; never mention creatures or monsters; player characters only.",
    );
    assertStringIncludes(user, "Speed: 30 ft");
    assertFalse(/\bSPD\b|\bSTR\b|old brief/.test(user));
    assertFalse(/creature|monster/i.test(request.messages[0].content));
    assertEquals(result.retrieval, "sheet");
    assertEquals(result.reply, "Thy Strength of 30 is beyond any mortal hero.");
    assertEquals(result.source, "Adjust Ability Scores, p. 21; Record Class Features, p. 22");
    assertEquals(result.findings?.filter((f) => f.severity === "fix").map((f) => f.field), [
      "Strength",
      "Features",
      "Traits",
      "Gear",
    ]);
  });

  Deno.test(`${name}: a clean sheet gets brief praise and no footer`, async () => {
    const { request, result } = await runReply(
      { question: "is my sheet ok?", character: CLEAN, ...voice },
      "A fine bard indeed.",
    );
    assertStringIncludes(request.messages[1].content, "found nothing to fix");
    assertStringIncludes(request.messages[1].content, "None.");
    assertEquals(result.source, "");
  });

  Deno.test(`${name}: an old app's brief is still reviewed by the checker`, async () => {
    const { request, result } = await runReply(
      {
        question: "Check my playersheet and tell me whats wrong",
        sheet: "Brakka Human Fighter L1\nSTR30 DEX12 CON14 INT8 WIS10 CHA10",
        ...voice,
      },
      "Mostly fine.",
    );
    assertStringIncludes(request.messages[1].content, "must change | Strength |");
    assertEquals(result.source, "Adjust Ability Scores, p. 21");
  });

  Deno.test(`${name}: a checklist reply loses its "Fix:" / "Suggestion:" labels and is flagged`, async () => {
    const checklist = [
      "Fix: Strength 30 exceeds the maximum of 20 for any character; lower it to 20 or less.",
      '**Fix:** Features list "Lol"; replace it with Bardic Inspiration and Spellcasting.',
      '- Fix (Traits): traits list "Yes"; change it to your species traits.',
      "Suggestion: Give thy character a name.",
      "suggest - put thy best score in Charisma.",
    ].join("\n");
    const { result } = await runReply(
      { question: "What you think of my chatacter sheet", character: DAVID, ...voice },
      checklist,
    );
    assertFalse(/fix|suggest/i.test(result.reply), result.reply);
    assertEquals(result.reply.split("\n"), [
      "Strength 30 exceeds the maximum of 20 for any character; lower it to 20 or less.",
      'Features list "Lol"; replace it with Bardic Inspiration and Spellcasting.',
      'Traits list "Yes"; change it to your species traits.',
      "Give thy character a name.",
      "Put thy best score in Charisma.",
    ]);
    assert(result.labelsStripped);
    const clean = await runReply(
      { question: "What you think of my chatacter sheet", character: DAVID, ...voice },
      "Ah, young one, thy Strength soars too high.",
    );
    assertFalse(clean.result.labelsStripped);
  });

  Deno.test(`${name}: sheet reviews keep the voice's own temperature`, async () => {
    const review = await runReply(
      { question: "What you think of my chatacter sheet", character: DAVID, ...voice },
      "ok",
    );
    const rules = await runReply({ question: "how does grappling work", ...voice }, "ok");
    assertEquals(review.request.temperature, rules.request.temperature);
    assertEquals(
      review.request.temperature,
      temperatureFor(voice.mode as "sage" | "bard", voice.style as "plain" | "wizard"),
    );
    assertEquals(review.request.maxTokens, rules.request.maxTokens);
  });
}

Deno.test("more than four must-change items may be a short list, still without labels", async () => {
  const broken = { ...DAVID, hp_max: 0, ac: 0 };
  const { request } = await runReply(
    { question: "check my sheet", character: broken, mode: "sage", style: "wizard" },
    "ok",
  );
  const user = request.messages[1].content;
  assertStringIncludes(user, "a short plain list is allowed");
  assertStringIncludes(user, 'No "Fix:" or "Suggestion:" labels');
});

Deno.test("the Wizard's reminder asks for thee, thy and wizardly turns throughout", () => {
  const wizard = voiceReminder("sage", "wizard", true);
  assertStringIncludes(wizard, "thee, thy and wizardly turns throughout");
  assertStringIncludes(wizard, "never a checklist or labels");
});

Deno.test("wizard, arbiter and bard send the same chat and sheet-review messages", async () => {
  const sheet = { question: "Check my playersheet and tell me whats wrong", character: DAVID };
  const chat = { question: "Damn", history: sheetRuling };
  for (const body of [sheet, chat]) {
    const sent = await Promise.all(SAGE_VOICES.map(([, v]) => runReply({ ...body, ...v }, "ok")));
    for (const other of sent.slice(1)) {
      assertEquals(
        other.request.messages.slice(1).map((m) => unvoiced(m.content)),
        sent[0].request.messages.slice(1).map((m) => unvoiced(m.content)),
      );
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
      const { request, result, searched } = await runReply(
        { question, ...voice },
        "Roll Charisma.\nSource: Falling, p. 179",
      );
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
      assertEquals(
        other.request.messages.slice(1).map((m) => unvoiced(m.content)),
        sent[0].request.messages.slice(1).map((m) => unvoiced(m.content)),
      );
      assertEquals(other.request.maxTokens, sent[0].request.maxTokens);
    }
  }
});

// No sheet sent (or the untouched template saved): every voice reviews the Character Sheet's blank template
// as incomplete with a fixed line, with no model call, so no voice praises it or brushes it off.
async function runFixed(body: Record<string, unknown>) {
  let calls = 0;
  const result = await ask(body, {
    chat: () => {
      calls += 1;
      return Promise.resolve("Thy sheet is splendid!");
    },
    party: () => Promise.resolve(""),
  });
  return { calls, result: result as AskReply };
}
const noSheetVoices: [string, Record<string, unknown>][] = [
  ["wizard", { mode: "sage", style: "wizard" }],
  ["arbiter", { mode: "sage", style: "plain" }],
  ["bard", { mode: "bard", style: "plain" }],
];
for (const [name, voice] of noSheetVoices) {
  Deno.test(`${name}: a sheet question with no sheet reviews the blank template as incomplete`, async () => {
    const { calls, result } = await runFixed({ question: "what do you think of my player sheet", ...voice });
    assertEquals(calls, 0);
    for (const word of ["species", "class", "name", "10", "traits", "features", "Character Sheet", "saves itself"]) {
      assertStringIncludes(result.reply, word);
    }
    assert(/join it on the Tome/i.test(result.reply), result.reply);
    assertFalse(/splendid|great|well done|fine sheet/i.test(result.reply));
    assertEquals(result.retrieval, "sheet");
    const fields = result.findings!.map((f) => f.field);
    for (const field of ["Species", "Class", "Ability Scores", "Features", "Traits", "Name"]) {
      assert(fields.includes(field), field);
    }
    assert(result.source.length > 0);
  });
  Deno.test(`${name}: the untouched template saved as is gets the same review`, async () => {
    const character = {
      name: "",
      race: "",
      class: "",
      level: 1,
      hp_current: 10,
      hp_max: 10,
      ac: 10,
      speed: 30,
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      features: "",
      languages: "",
      skills: [],
    };
    const blank = await runFixed({ question: "check my sheet", ...voice });
    const { calls, result } = await runFixed({ question: "check my sheet", character, ...voice });
    assertEquals(calls, 0);
    assertEquals(result.reply, blank.result.reply);
  });
  Deno.test(`${name}: in a party, the template review skips the join step`, async () => {
    const partyId = "00000000-0000-4000-8000-000000000000";
    const { calls, result } = await runFixed({ question: "check my sheet", partyId, ...voice });
    assertEquals(calls, 0);
    assertFalse(/join it/i.test(result.reply));
  });
  Deno.test(`${name}: "where must I" after the template review repeats it`, async () => {
    const first = await runFixed({ question: "what do you think of my player sheet", ...voice });
    const history = [{ q: "what do you think of my player sheet", a: first.result.reply }];
    const { calls, result } = await runFixed({ question: "where must I", history, ...voice });
    assertEquals(calls, 0);
    assertEquals(result.reply, first.result.reply);
  });
  Deno.test(`${name}: a cut-off question with no history asks again instead of guessing`, async () => {
    const { calls, result } = await runFixed({ question: "where must I", ...voice });
    assertEquals(calls, 0);
    assertStringIncludes(result.reply, "orb");
  });
}

Deno.test("a filled-in sheet still goes to the checker and the model, not the fixed line", async () => {
  const { calls, result } = await runFixed({
    question: "what do you think of my sheet",
    sheet: "Level 3 Human Fighter",
    mode: "sage",
    style: "wizard",
  });
  assertEquals(calls, 1);
  assertEquals(result.retrieval, "sheet");
});

Deno.test("temperatures: Wizard 0.25, Arbiter 0.3, Bard 0.35, Scribe 0.2", () => {
  assertEquals(temperatureFor("sage", "wizard"), 0.25);
  assertEquals(temperatureFor("sage", "plain"), 0.3);
  assertEquals(temperatureFor("bard", "plain"), 0.35);
  assertEquals(temperatureFor("bard", "wizard"), 0.35);
  assertEquals(temperatureFor("scribe"), 0.2);
});

// Rules answers never come from the small fallback model; chat, the Scribe and sheet reviews
// (which only explain the checker's findings) keep it.
for (
  const [name, body, fallback] of [
    ["rules question", { question: "how does grappling work", mode: "sage", style: "plain" }, false],
    ["chat", { question: "Hello", mode: "sage", style: "plain" }, true],
    ["scribe", { question: "Thorin grappled the goblin", mode: "scribe" }, true],
    ["sheet review", { question: "check my sheet", sheet: "Level 3 Human Fighter", mode: "bard" }, true],
  ] as const
) {
  Deno.test(`${name}: fallback to the small model is ${fallback ? "allowed" : "off"}`, async () => {
    const { request } = await run(body);
    assertEquals(request.fallback, fallback);
  });
}

Deno.test("the reply names the model that wrote it", async () => {
  const result = (await ask({ question: "how does grappling work", mode: "bard" }, {
    chat: () => Promise.resolve({ text: "Grab and hold!", model: "openai/gpt-oss-20b" }),
    party: () => Promise.resolve(""),
  })) as AskReply;
  assertEquals(result.model, "openai/gpt-oss-20b");
  const plain = await run({ question: "how does grappling work", mode: "sage" });
  assertEquals(plain.result.model, PERSONAS.sage.model);
});

Deno.test("a busy chat call is not turned into the busy line", async () => {
  let threw = false;
  try {
    await ask({ question: "Hello", mode: "sage" }, {
      chat: () => Promise.reject(new Error("down")),
      party: () => Promise.resolve(""),
    });
  } catch {
    threw = true;
  }
  assert(threw);
});
