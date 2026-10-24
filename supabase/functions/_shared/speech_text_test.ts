// deno test supabase/functions/_shared/speech_text_test.ts
// The app's own safety net (src/lib/speechText.ts): what expo-speech is given to read aloud.
// It is plain TypeScript with no React Native imports, so it is tested here with the function tests.
import { assertEquals, assertFalse } from "jsr:@std/assert@1";
import { dropLabels as appDropLabels, hasLabels as appHasLabels, speakable, splitSource } from "../../../src/lib/speechText.ts";
import { dropLabels, hasLabels, splitReply } from "./reply.ts";

const wizard = "Thy sheet is missing an alignment. Thy Strength of 30 is beyond the usual range. Those are the clear issues. " +
  "(SRD: Creation > Create Your Character > Step 4: Alignment, p. 21; SRD: Creation > Create Your Character > Step 5: Character Creation Details, p. 22)";
const arbiter = "Half cover gives +2 to AC and Dexterity saving throws.\nSource: Cover, p. 179";
const bard = "Eight d6 of fire, a blazing delight! **Fireball** burns bright. Source: Fireball, p. 131";

Deno.test("speech never reads citations for the Wizard, the Arbiter or the Bard", () => {
  for (const reply of [wizard, arbiter, bard]) {
    const spoken = speakable(reply);
    assertFalse(/SRD|Source|p\. ?\d|>|\*/.test(spoken), spoken);
  }
  assertEquals(speakable(bard), "Eight d6 of fire, a blazing delight! Fireball burns bright.");
});

Deno.test("the app splits the same way as the function", () => {
  const variants = [
    "Half cover is +2 AC.\n**Source:** Cover, p. 179",
    "Half cover is +2 AC.\nSources: Cover, p. 179; Prone, p. 190",
    "Half cover is +2 AC.\nSource — Cover, p. 179",
    "Half cover is +2 AC. — Source: Cover, p. 179",
    "Duck!\nSource: Cover, p. 179\nA crate, a wall,\nshields one and all!",
    "Source: Cover, p. 179",
    "Source of the curse: a hag.",
  ];
  for (const reply of [wizard, arbiter, bard, "Roll a d20 (with Advantage).", "Lore: Asmodeus rules the Nine Hells.", ...variants]) {
    assertEquals(splitSource(reply), splitReply(reply), reply);
  }
});

Deno.test("markdown and line breaks become plain speech", () => {
  assertEquals(speakable("## Grappling\n- Use an **Unarmed Strike**\n- The target makes a save"), "Grappling. Use an Unarmed Strike. The target makes a save");
});

// David's Wizard review as it came back: a checklist. Old deployed functions still send it, so the
// app strips the labels too, and they are never shown or spoken.
const checklist = [
  "Fix: Strength 30 exceeds the maximum of 20 for any character; lower it to 20 or less.",
  '**Fix:** Features list "Lol"; replace it with Bardic Inspiration and Spellcasting.',
  "Suggestion: Give thy character a name...",
  "suggest - put thy best score in Charisma.",
].join("\n");

Deno.test("the app never shows or speaks Fix: / Suggestion: labels", () => {
  const spoken = speakable(checklist);
  assertFalse(/fix|suggest/i.test(spoken), spoken);
  assertEquals(
    spoken,
    'Strength 30 exceeds the maximum of 20 for any character; lower it to 20 or less. Features list "Lol"; replace it with Bardic Inspiration and Spellcasting. Give thy character a name. Put thy best score in Charisma.',
  );
  assertFalse(/fix|suggest/i.test(splitSource(checklist).text));
});

Deno.test("the app strips labels exactly like the function", () => {
  for (const reply of [checklist, "**Fix (Gear):** add a lute.", "Fix the strap first.", "A quick fix: lower it.", "Ah.\n**Fixes:**\nFix: lower it."]) {
    assertEquals(appDropLabels(reply), dropLabels(reply), reply);
    assertEquals(appHasLabels(reply), hasLabels(reply), reply);
    assertEquals(splitSource(reply), splitReply(reply), reply);
  }
});
