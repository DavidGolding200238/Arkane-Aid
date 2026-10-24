// deno test --allow-read supabase/functions/_shared/smalltalk_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { chatKind } from "./smalltalk.ts";

const cases: [string, string | null][] = [
  // Off-topic requests are not chat: they reach the model under the scope rule.
  ["how do I reverse a string in python", null],
  ["solve 3x + 5 = 20 for my maths homework", null],
  ["who won the football last night", null],
  ["my rogue tries to seduce a dragon mid-fall, what happens?", null],
  ["Hello", "greeting"],
  ["hi there", "greeting"],
  ["Good morning, Arbiter", "greeting"],
  ["thanks!", "thanks"],
  ["damn, thanks", "thanks"],
  ["bye", "farewell"],
  ["Damn", "chat"],
  ["damn.", "chat"],
  ["wow", "chat"],
  ["ok", "chat"],
  ["okay cool", "chat"],
  ["lol", "chat"],
  ["hmm", "chat"],
  ["nice", "chat"],
  ["ugh", "chat"],
  ["oof", "chat"],
  ["fuck", "chat"],
  ["what the hell", "chat"],
  ["hell yeah", "chat"],
  ["oh no", "chat"],
  ["fair enough", "chat"],
  ["how are you?", "chat"],
  ["I'm good thanks", "chat"],
  // Real questions are searched.
  ["help", null],
  ["shield", null],
  ["hellish rebuke", null],
  ["hail of thorns", null],
  ["damn, how does grappling work", null],
  ["wow can I cast fireball twice", null],
  ["is hell a plane", null],
  ["ok what does prone do", null],
  // Emoji or punctuation only is a reaction; another script is still a question.
  ["👍👍", "chat"],
  ["😂😂😂", "chat"],
  ["?!?", "chat"],
  ["", null],
  ["Как работает захват?", null],
];

for (const [text, kind] of cases) {
  Deno.test(`"${text}" is ${kind ?? "a real question"}`, () => assertEquals(chatKind(text), kind));
}
