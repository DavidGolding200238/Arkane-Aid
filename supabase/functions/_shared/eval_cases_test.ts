// The sheet cases in evals/sage-eval.json, run through the real request path with Groq mocked:
// the deterministic parts (review detection, the checker's fixes, the footer) must already match
// what the eval expects, so a live eval failure can only be the model's wording.
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { ask, type AskDeps, type AskReply, BUSY } from "./ask.ts";
import { type ChatRequest, GroqError } from "./groq.ts";
import { NO_EXTRACT } from "./message.ts";
import evals from "../../../evals/sage-eval.json" with { type: "json" };
import { checkReply, type EvalCase, voiceCheck } from "../../../evals/lib.ts";

type Case = {
  id: string;
  kind: string;
  question: string;
  sheet?: string;
  character?: Record<string, unknown>;
  fix_fields?: string[];
  source?: string[];
  no_source?: boolean;
};

for (const c of (evals.cases as Case[]).filter((c) => c.fix_fields)) {
  for (
    const voice of [{ mode: "sage", style: "wizard" }, { mode: "sage", style: "plain" }, {
      mode: "bard",
      style: "plain",
    }]
  ) {
    Deno.test(`eval ${c.id} (${voice.mode}/${voice.style}): checker and footer match the eval`, async () => {
      const result = (await ask({ question: c.question, sheet: c.sheet ?? "", character: c.character, ...voice }, {
        chat: () => Promise.resolve("A fine start."),
        party: () => Promise.resolve(""),
      })) as AskReply;
      assertEquals(result.retrieval, "sheet");
      assertEquals(result.findings?.filter((f) => f.severity === "fix").map((f) => f.field), c.fix_fields);
      if (c.no_source) assertEquals(result.source, "");
      if (c.source) assert(c.source.some((s) => result.source.includes(s)), result.source);
    });
  }
}

// The live eval's own checks: a checklist reply fails sheet-david, and each voice is checked.
const david = (evals.cases as EvalCase[]).find((c) => c.id === "sheet-david")!;
const failed = (reply: string, meta = {}) => checkReply(david, reply, meta).filter((c) => !c.pass).map((c) => c.name);
const LABEL_CHECK = 'no "Fix:" / "Suggestion:" labels';

Deno.test("sheet-david fails on Fix: / Suggestion: labels, or when the function had to strip them", () => {
  assert(david.no_labels);
  const checklist =
    'Fix: Strength 30 exceeds the maximum of 20; lower it to 20 or less.\nFix: Features list "Lol".\nSuggestion: Give thy character a name.';
  assert(failed(checklist).includes(LABEL_CHECK));
  assert(failed("**Suggestion (Name):** name thy hero. Strength 20, features lol.").includes(LABEL_CHECK));
  const prose =
    'Ah, young one, thy Strength of 30 soars past the 20 a hero may hold; lower it. Thy features say "Lol", so write Bardic Inspiration there.';
  assertFalse(failed(prose).includes(LABEL_CHECK));
  assert(failed(prose, { labelsStripped: true }).includes(LABEL_CHECK));
});

Deno.test("the tone check covers all three voices", () => {
  const wizard = "Ah, young one, thy Strength of 30 soars past 20.";
  const arbiter = "Your Strength of 30 is above the limit of 20. Lower it.";
  const bard = "A Strength of 30? What a tale! Lower it to 20, friend.";
  assert(voiceCheck("wizard", wizard).pass);
  assertFalse(voiceCheck("wizard", arbiter).pass);
  assert(voiceCheck("arbiter", arbiter).pass);
  assertFalse(voiceCheck("arbiter", wizard).pass);
  assert(voiceCheck("bard", bard).pass);
  assertFalse(voiceCheck("bard", arbiter).pass);
  for (const id of ["sheet-david", "sheet-review", "sheet-clean"]) assert(evals.tone.includes(id), id);
});

// Failure cases from real play (David's mum's new account), run through the real request path
// with Groq mocked, for every voice: what the Sage must do without leaning on the model.
const VOICES = [{ mode: "sage", style: "wizard" }, { mode: "sage", style: "plain" }, {
  mode: "bard",
  style: "plain",
}] as const;
const flavourOf = (v: (typeof VOICES)[number]) => (v.mode === "bard" ? "bard" : v.style);
const BLANK_TEMPLATE = {
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

async function askMocked(
  body: Record<string, unknown>,
  chat: AskDeps["chat"] = () => Promise.resolve("Splendid sheet!"),
) {
  const sent: ChatRequest[] = [];
  const result = await ask(body, {
    chat: (request) => {
      sent.push(request);
      return chat(request);
    },
    party: () => Promise.resolve(""),
  });
  return { sent, result: result as AskReply };
}
const lastUser = (r: ChatRequest) => r.messages[r.messages.length - 1].content;

for (const voice of VOICES) {
  const label = `${voice.mode}/${voice.style}`;

  Deno.test(`eval blank-template (${label}): the untouched template is reviewed as incomplete, never praised`, async () => {
    const { sent, result } = await askMocked({
      question: "what do you think of my character sheet",
      character: BLANK_TEMPLATE,
      ...voice,
    });
    assertEquals(sent.length, 0);
    assertEquals(result.retrieval, "sheet");
    assertFalse(/splendid/i.test(result.reply));
    for (const word of ["species", "class", "10", "Character Sheet", "saves itself"]) {
      assert(result.reply.includes(word), word);
    }
  });

  Deno.test(`eval no-saved-sheet (${label}): a sheet question with no sheet gets the same incomplete review`, async () => {
    const { sent, result } = await askMocked({ question: "check my sheet", ...voice });
    assertEquals(sent.length, 0);
    assertEquals(result.retrieval, "sheet");
    assert(result.reply.includes("saves itself"), result.reply);
    assertEquals(result.model, "none");
  });

  Deno.test(`eval misheard-follow-up (${label}): "where must I" never gets a guessed rule`, async () => {
    const alone = await askMocked({ question: "where must I", ...voice });
    assertEquals(alone.sent.length, 0);
    assertEquals(alone.result.sources, []);
    const review = await askMocked({ question: "check my sheet", ...voice });
    const after = await askMocked({
      question: "where must I",
      history: [{ q: "check my sheet", a: review.result.reply }],
      ...voice,
    });
    assertEquals(after.sent.length, 0);
    assertEquals(after.result.reply, review.result.reply);
  });

  Deno.test(`eval low-relevance (${label}): a question the SRD does not cover gets no extracts and is told so`, async () => {
    const { sent, result } = await askMocked(
      { question: "is that allowed", ...voice },
      () => Promise.resolve("Not in my loaded rules; the DM decides."),
    );
    assertEquals(sent.length, 1);
    assertStringIncludes(lastUser(sent[0]), NO_EXTRACT);
    assertEquals(result.sources, []);
    assertEquals(result.source, "");
    assertFalse(result.grounded);
  });

  Deno.test(`eval fallback-busy (${label}): a busy big model gives the fixed busy line, never the small model`, async () => {
    const { sent, result } = await askMocked({ question: "how does grappling work", ...voice }, (request) => {
      assertEquals(request.fallback, false);
      return Promise.reject(new GroqError("rate limited", 429));
    });
    assertEquals(sent.length, 1);
    assertEquals(result.reply, BUSY[flavourOf(voice)]);
    assert(result.busy);
    assertEquals(result.model, "none");
    assertEquals(result.sources, []);
  });

  Deno.test(`eval not-in-rules (${label}): the prompt says not sure, the DM decides, and no made-up numbers`, async () => {
    const { sent } = await askMocked(
      { question: "how does grappling work", ...voice },
      () => Promise.resolve("Grappled."),
    );
    const system = sent[0].messages[0].content;
    assertStringIncludes(system, "not in the loaded rules");
    assertStringIncludes(system, "the dungeon master decides");
    assertStringIncludes(system, "Never state numbers, dice, DCs, ranges");
    assertFalse(system.includes("still help"));
    assertFalse(system.includes("Never refuse just because an extract is missing"));
  });
}

Deno.test("homebrew species: the Sage gets the sheet's homebrew traits and the rule to use them, not just 'ask your DM'", async () => {
  const character = {
    name: "Ryn",
    race: "Owlfolk",
    class: "Bard",
    level: 1,
    hp_current: 9,
    hp_max: 9,
    ac: 12,
    speed: 25,
    str: 8,
    dex: 14,
    con: 12,
    int: 10,
    wis: 12,
    cha: 15,
    skills: ["Performance"],
    languages: "Common",
    features: "Bardic Inspiration",
    traits: [],
    gear: ["Lute"],
    homebrew: { bonuses: "+2 DEX, +1 WIS", size: "Small", speed: 25, abilities: "Flight 30 ft" },
  };
  const { sent } = await askMocked({ question: "check my character sheet", character, mode: "sage", style: "plain" });
  assertEquals(sent.length, 1);
  const system = sent[0].messages[0].content;
  assertStringIncludes(system, "homebrew species traits");
  assertStringIncludes(system, "say they are homebrew");
  // Still real advice: the closest official species as a guide, and the DM only for a genuine ruling.
  assertStringIncludes(system, "closest official species");
  assertStringIncludes(system, "never as the default answer");
  const user = lastUser(sent[0]);
  assertStringIncludes(user, "Homebrew species traits (the table's homebrew, written on the sheet)");
  assertStringIncludes(user, "Flight 30 ft");
  assertFalse(/check it with them/i.test(user), user);
});
