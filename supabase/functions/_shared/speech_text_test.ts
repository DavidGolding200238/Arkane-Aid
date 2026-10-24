// deno test supabase/functions/_shared/speech_text_test.ts
// The app's own safety net (src/lib/speechText.ts): what expo-speech is given to read aloud.
// It is plain TypeScript with no React Native imports, so it is tested here with the function tests.
import { assertEquals, assertFalse } from "jsr:@std/assert@1";
import { speakable, splitSource } from "../../../src/lib/speechText.ts";
import { splitReply } from "./reply.ts";

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
