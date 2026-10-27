// The how-to tips: shown once as a pop-up the first time someone signs in on this phone, and
// always under Guidance in the Tome. Short lines and plain words, so they are easy to read.

export type Tip = { title: string; body: string };

export const GUIDANCE: Tip[] = [
  {
    title: "Talk to the Sage",
    body: "Open the Sage. Press and hold the orb, then speak. Let go to send. The Sage answers rules and lore questions. You can type too.",
  },
  {
    title: "Take notes with the Scribe",
    body: "Pick Scribe, then hold the orb and speak. Let go and the Scribe saves it as a note in the Codex.",
  },
  {
    title: "Fill in your Character Sheet",
    body: "Open the Codex and tap the Sheet tab. Add your abilities, HP, AC and gear. It saves itself, and the Sage reads it when it helps.",
  },
  {
    title: "Keep the Codex",
    body: "Party notes and items live here for everyone. Your weapons and spells live here too. Tap your own note to change it. Press and hold your own note or item to delete it.",
  },
  {
    title: "Roll the dice",
    body: "Tap the d20 on Home. Check rolls a skill, save, attack or death save from your Character Sheet with every bonus shown; set a DC to see if it worked. Free roll throws any dice. Tap Roll or shake your phone.",
  },
  {
    title: "Open the Tome",
    body: "Sign in with email or Google, make or join a party with its 6-character code, and pick the Sage's voice. These tips stay here.",
  },
  {
    title: "2024 rules",
    body: "Arkane Aid uses the 2024 rules. Orc is a starting species. Subraces are now lineages, like High Elf. A species not in the rules is homebrew: write its traits on your sheet.",
  },
];

/** The pop-up shows once per account on this phone. */
export function guidanceKey(userId: string) {
  return `guidance-seen:${userId}`;
}

export function guidanceSeen(userId: string): boolean {
  try {
    return localStorage.getItem(guidanceKey(userId)) === "1";
  } catch {
    return true; // no storage: never nag
  }
}

export function markGuidanceSeen(userId: string) {
  try {
    localStorage.setItem(guidanceKey(userId), "1");
  } catch {
    // The pop-up just shows again next time.
  }
}
