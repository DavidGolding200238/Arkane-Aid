// The races and classes the Character Sheet offers. The Sage's sheet checker keeps the same lists in
// supabase/functions/_shared/sheet_check.ts; a Deno test (sheet_check_test.ts) keeps them equal.

export const RACES = ["Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human", "Orc", "Tiefling"];

export const CLASSES = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

/** The one subclass each class has in the SRD 5.2.1 (any other is written in as Custom). */
export const SUBCLASSES: Record<string, string> = {
  Barbarian: "Path of the Berserker",
  Bard: "College of Lore",
  Cleric: "Life Domain",
  Druid: "Circle of the Land",
  Fighter: "Champion",
  Monk: "Warrior of the Open Hand",
  Paladin: "Oath of Devotion",
  Ranger: "Hunter",
  Rogue: "Thief",
  Sorcerer: "Draconic Sorcery",
  Warlock: "Fiend Patron",
  Wizard: "Evoker",
};

/** The SRD 5.2.1 species that choose a lineage (Elven Lineage, Draconic Ancestry, ...), with its options. */
export const LINEAGES: Record<string, { title: string; options: string[] }> = {
  Dragonborn: {
    title: "Draconic Ancestry",
    options: [
      "Black (Acid)",
      "Blue (Lightning)",
      "Brass (Fire)",
      "Bronze (Lightning)",
      "Copper (Acid)",
      "Gold (Fire)",
      "Green (Poison)",
      "Red (Fire)",
      "Silver (Cold)",
      "White (Cold)",
    ],
  },
  Elf: { title: "Elven Lineage", options: ["Drow", "High Elf", "Wood Elf"] },
  Gnome: { title: "Gnomish Lineage", options: ["Forest Gnome", "Rock Gnome"] },
  Goliath: {
    title: "Giant Ancestry",
    options: ["Cloud Giant", "Fire Giant", "Frost Giant", "Hill Giant", "Stone Giant", "Storm Giant"],
  },
  Tiefling: { title: "Fiendish Legacy", options: ["Abyssal", "Chthonic", "Infernal"] },
};

/** True for a species written in by hand (not one of the SRD species): its traits are homebrew. */
export function isCustomRace(race: string): boolean {
  const name = race.trim().toLowerCase();
  return !!name && !RACES.some((r) => r.toLowerCase() === name);
}
