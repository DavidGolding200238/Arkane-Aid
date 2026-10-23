// deno test supabase/functions/_shared/message_test.ts
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { userMessage } from "./message.ts";
import { PERSONAS, systemPrompt, type Mode } from "./personas.ts";
import { isSmallTalk } from "./smalltalk.ts";
import { srd } from "./srd.ts";

for (const text of ["Hello", "hello!", "Hi there", "hey sage", "Thanks", "thank you so much", "Who are you?", "Good morning, Arbiter", "hi, who are you?", "Hail!", "cheers mate"]) {
  Deno.test(`"${text}" is small talk`, () => assert(isSmallTalk(text)));
}

for (const text of ["hellish rebuke", "hail of thorns", "hi, how does grappling work?", "thanks, and what does fireball do", "help", "shield"]) {
  Deno.test(`"${text}" is a real question`, () => assertFalse(isSmallTalk(text)));
}

Deno.test("common English words are never 'corrected' into SRD terms", () => {
  for (const word of ["hello", "hi there", "thanks", "shield", "hello, how does grappling work"]) {
    assertEquals(srd.search(word).corrections, [], word);
  }
  assertEquals(srd.correctWord("hello"), null);
  assertEquals(srd.correctWord("shield"), null);
});

Deno.test("hellish rebuke is still found exactly", () => {
  const result = srd.search("hellish rebuke");
  assertEquals(result.hits[0]?.title, "Hellish Rebuke");
  assertEquals(result.corrections, []);
});

Deno.test("shield is not altered and finds Shield", () => {
  const result = srd.search("shield");
  assertEquals(result.corrections, []);
  assertEquals(result.hits[0]?.title, "Shield");
});

Deno.test("real typos are still corrected", () => {
  assertEquals(srd.search("firebal").corrections, [{ from: "firebal", to: "Fireball" }]);
  assertEquals(srd.search("grapled").corrections, [{ from: "grapled", to: "Grappled" }]);
  assertEquals(srd.search("owlbaer").corrections, [{ from: "owlbaer", to: "Owlbear" }]);
  assertEquals(srd.correctWord("firebal"), "fireball");
});

Deno.test("small talk skips the SRD: a lean chat note and the message, nothing else", () => {
  const message = userMessage("Hello", null, "", "", { kind: "greeting", hasHistory: false });
  assertStringIncludes(message, "<chat>");
  assertStringIncludes(message, "Greet back");
  assertFalse(message.includes("<srd>"));
  assert(message.length < 200, `${message.length} chars`);
});

Deno.test("a reaction never asks for a greeting, with or without history", () => {
  for (const hasHistory of [true, false]) {
    const message = userMessage("Damn", null, "", "", { kind: "chat", hasHistory });
    assertStringIncludes(message, "Do not greet");
    assertFalse(/Greet back/.test(message));
  }
});

Deno.test("hello mid-conversation does not start over", () => {
  assertStringIncludes(userMessage("hi", null, "", "", { kind: "greeting", hasHistory: true }), "do not start over");
});

Deno.test("SRD extracts carry short tags, not the whole breadcrumb", () => {
  const message = userMessage("how does alignment work", srd.search("alignment"), "", "");
  assertStringIncludes(message, "p. 21]");
  assertFalse(message.includes(" > "));
  assertFalse(message.includes("SRD 5.2.1,"));
});

Deno.test("spelling fixes are passed as guesses, never as fact", () => {
  const message = userMessage("firebal damage", srd.search("firebal damage"), "", "");
  assertStringIncludes(message, "<possible_corrections>");
  assertStringIncludes(message, '"firebal" might mean Fireball');
  assertStringIncludes(message, "otherwise ignore it");
  assertFalse(/is a typo for/i.test(message));
});

const voices: [Mode, "plain" | "wizard", string][] = [
  ["sage", "plain", "you are the Arbiter"],
  ["sage", "wizard", "old court mage"],
  ["bard", "plain", "you are the Bard"],
  ["scribe", "plain", "you are the Scribe"],
];
for (const [mode, style, identity] of voices) {
  Deno.test(`${mode}/${style} greets in character and never labels chat Lore`, () => {
    const prompt = systemPrompt(mode, style);
    assertStringIncludes(prompt, identity);
    assertStringIncludes(prompt, "Greet only when greeted");
    assertStringIncludes(prompt, 'Never label chat "Lore:"');
    assert(PERSONAS[mode]);
  });
}
