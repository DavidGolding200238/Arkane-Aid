import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { errorText } from "./parties";
import { type Spell, type Weapon, spellLine, suggestedToHit, weaponLine } from "./arsenal";
import { isCustomRace } from "./sheetLists";

/** What a player writes for a custom (homebrew) species. Stored as characters.race_traits. */
export type RaceTraits = {
  /** Ability score increases, as written: "+2 STR, +1 CON". */
  bonuses: string;
  size: string;
  /** Walking speed in feet, or null when not written. */
  speed: number | null;
  /** A short list of the species' abilities, one per line. */
  abilities: string;
};

export const EMPTY_RACE_TRAITS: RaceTraits = { bonuses: "", size: "", speed: null, abilities: "" };

const hasRaceTraits = (t: RaceTraits | null | undefined): t is RaceTraits =>
  !!t && !!(t.bonuses.trim() || t.size.trim() || t.speed !== null || t.abilities.trim());

export type Character = {
  id: string;
  user_id: string;
  party_id: string | null;
  name: string;
  class: string | null;
  race: string | null;
  subclass: string | null;
  lineage: string | null;
  race_traits: RaceTraits | null;
  background: string | null;
  level: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  speed: number;
  languages: string | null;
  features: string | null;
  skills: string[];
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  portrait_url: string | null;
};

export type Equipment = {
  id: string;
  character_id: string;
  name: string;
  quantity: number;
  notes: string | null;
  source: "user" | "scribe";
};

export type Trait = {
  id: string;
  character_id: string;
  name: string;
  source: "user" | "scribe";
};

export type CharacterDraft = {
  name: string;
  class: string;
  race: string;
  subclass: string;
  lineage: string;
  raceTraits: RaceTraits;
  background: string;
  level: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  speed: number;
  languages: string;
  features: string;
  skills: string[];
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

/** The blank sheet a new character starts from. Opening it never saves it; only a real edit does. */
export const EMPTY_DRAFT: CharacterDraft = {
  name: "",
  class: "",
  race: "",
  subclass: "",
  lineage: "",
  raceTraits: EMPTY_RACE_TRAITS,
  background: "",
  level: 1,
  hp_current: 10,
  hp_max: 10,
  ac: 10,
  speed: 30,
  languages: "",
  features: "",
  skills: [],
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

const NEW_COLUMNS_SQL =
  "Subclass, lineage and homebrew traits need the latest database update (npx supabase db push, migration 20261027000007). Everything else is saved.";

/** The sheet saved, but without subclass, lineage and homebrew traits: the database is missing them. */
export class SheetUpdateNeeded extends Error {
  saved: Character;
  constructor(saved: Character) {
    super(NEW_COLUMNS_SQL);
    this.saved = saved;
  }
}

const SHEET_SQL =
  "Run supabase/003_level_hp_traits.sql in the SQL editor once. It adds level, HP, and the traits list.";
const COMBAT_SQL =
  "Run supabase/004_sheet_combat.sql in the SQL editor once. It adds armor class, speed, skills, languages, and features.";

const SHEET_WORDS =
  /\b(my|mine|me|i|i'm|im|character|sheet|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha|class|race|species|gear|equipment|trait|traits|background|inventory|level|hp|hit|ac|armor|speed|skill|language|spell|spells|cast|weapon|weapons|attack|sword|subclass|lineage|homebrew|feature|can i|do i|am i)\b/i;

export const SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
] as const;

export function proficiencyBonus(level: number) {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}

function clip(value: string | null | undefined, max: number) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

function decodeBase64(input: string) {
  const clean = input.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function loadCharacter(partyId: string | null): Promise<Character | null> {
  const uid = await userId();
  let query = supabase.from("characters").select("*").eq("user_id", uid);
  query = partyId ? query.eq("party_id", partyId) : query.is("party_id", null);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  const row = (data?.[0] as Character | undefined) ?? null;
  if (!row) return null;
  return {
    ...row,
    level: row.level ?? 1,
    hp_current: row.hp_current ?? 10,
    hp_max: row.hp_max ?? 10,
    ac: row.ac ?? 10,
    speed: row.speed ?? 30,
    languages: row.languages ?? null,
    features: row.features ?? null,
    skills: Array.isArray(row.skills) ? row.skills : [],
    subclass: row.subclass ?? null,
    lineage: row.lineage ?? null,
    race_traits: readRaceTraits(row.race_traits),
  };
}

function readRaceTraits(value: unknown): RaceTraits | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const speed = typeof v.speed === "number" && Number.isFinite(v.speed) ? Math.round(v.speed) : null;
  const traits = { bonuses: str(v.bonuses), size: str(v.size), speed, abilities: str(v.abilities) };
  return hasRaceTraits(traits) ? traits : null;
}

export function needsSheet(question: string) {
  return SHEET_WORDS.test(question);
}

/** The full sheet as fields, for the Sage's deterministic sheet checker (supabase/functions/_shared/sheet_check.ts). */
export type SheetData = {
  name: string;
  race: string;
  class: string;
  level: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  speed: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  skills: string[];
  languages: string;
  features: string;
  traits: string[];
  gear: string[];
  subclass: string;
  lineage: string;
  /** Only for a custom species: the traits the player wrote, which are the table's homebrew. */
  homebrew: { bonuses: string; size: string; speed: number | null; abilities: string } | null;
  /** The weapon in hand, as one line ("Longsword +5 to hit, 1d8 Slashing"). */
  weapon: string;
  spells: string[];
};

/** The Codex's weapons and spells, sent with the sheet. */
export type Arsenal = { weapons?: Weapon[]; spells?: Spell[] };

function homebrewOf(character: Character) {
  if (!isCustomRace(character.race ?? "") || !hasRaceTraits(character.race_traits)) return null;
  const t = character.race_traits;
  return {
    bonuses: clip(t.bonuses, 80),
    size: clip(t.size, 20),
    speed: t.speed,
    abilities: clip(lines(t.abilities), 300),
  };
}

function inHand(character: Character, weapons: Weapon[] = []) {
  const weapon = weapons.find((w) => w.in_hand);
  if (!weapon) return "";
  return weaponLine(weapon, suggestedToHit(weapon.properties, character, proficiencyBonus(character.level)));
}

// Keeps one-per-line lists apart once clip folds the whitespace: "Rage\nWeapon Mastery" -> "Rage; Weapon Mastery".
const lines = (value: string | null) => (value ?? "").replace(/\s*\n+\s*/g, "; ");

export function sheetData(
  character: Character | null,
  gear: Equipment[],
  traits: Trait[] = [],
  arsenal: Arsenal = {}
): SheetData | null {
  if (!character) return null;
  return {
    name: clip(character.name, 40),
    race: clip(character.race, 30),
    class: clip(character.class, 30),
    level: character.level,
    hp_current: character.hp_current,
    hp_max: character.hp_max,
    ac: character.ac,
    speed: character.speed,
    str: character.str,
    dex: character.dex,
    con: character.con,
    int: character.int,
    wis: character.wis,
    cha: character.cha,
    skills: (character.skills ?? []).slice(0, 18),
    languages: clip(lines(character.languages), 200),
    features: clip(lines(character.features), 400),
    traits: traits.slice(0, 8).map((t) => clip(t.name, 40)).filter(Boolean),
    gear: gear.slice(0, 12).map((g) => clip(g.name, 40)).filter(Boolean),
    subclass: clip(character.subclass, 40),
    lineage: clip(character.lineage, 40),
    homebrew: homebrewOf(character),
    weapon: inHand(character, arsenal.weapons),
    spells: (arsenal.spells ?? []).slice(0, 30).map((s) => clip(spellLine(s), 50)),
  };
}

export function sheetBrief(
  character: Character | null,
  gear: Equipment[],
  traits: Trait[] = [],
  arsenal: Arsenal = {}
): string {
  if (!character) return "";
  const name = clip(character.name, 24) || "Unnamed";
  const lineage = clip(character.lineage, 24);
  const subclass = clip(character.subclass, 28);
  const race = [clip(character.race, 16), lineage ? `(${lineage})` : ""].filter(Boolean).join(" ");
  const klass = [clip(character.class, 16), subclass ? `(${subclass})` : ""].filter(Boolean).join(" ");
  const who = [name, race, klass, `L${character.level}`].filter(Boolean).join(" ");
  const combat = `AC${character.ac} SPD${character.speed} PB+${proficiencyBonus(character.level)} HP ${character.hp_current}/${character.hp_max}`;
  const stats = `STR${character.str} DEX${character.dex} CON${character.con} INT${character.int} WIS${character.wis} CHA${character.cha}`;
  const skills = (character.skills ?? []).slice(0, 8).join(", ");
  const gearLine = gear
    .slice(0, 6)
    .map((item) => clip(item.name, 24))
    .filter(Boolean)
    .join(", ");
  const traitLine = traits
    .slice(0, 4)
    .map((item) => clip(item.name, 24))
    .filter(Boolean)
    .join(", ");
  const features = clip(character.features, 80);
  const brew = homebrewOf(character);
  const homebrew = brew
    ? `Homebrew species traits (written on the sheet): ${[
        brew.bonuses,
        brew.size ? `Size ${brew.size}` : "",
        brew.speed !== null ? `Speed ${brew.speed} ft` : "",
        brew.abilities,
      ]
        .filter(Boolean)
        .join("; ")}`
    : "";
  const weapon = inHand(character, arsenal.weapons);
  const spells = (arsenal.spells ?? [])
    .slice(0, 16)
    .map((s) => clip(spellLine(s), 32))
    .join(", ");
  return [
    who,
    combat,
    stats,
    skills ? `Skills: ${skills}` : "",
    gearLine ? `Gear: ${gearLine}` : "",
    traitLine ? `Traits: ${traitLine}` : "",
    features ? `Features: ${features}` : "",
    homebrew,
    weapon ? `In hand: ${weapon}` : "",
    spells ? `Spells: ${spells}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export async function saveCharacter(
  partyId: string | null,
  draft: CharacterDraft,
  existing: Character | null
): Promise<Character> {
  const uid = await userId();
  const row = {
    user_id: uid,
    party_id: partyId,
    name: draft.name.trim(),
    class: draft.class.trim() || null,
    race: draft.race.trim() || null,
    background: draft.background.trim() || null,
    subclass: draft.subclass.trim() || null,
    lineage: draft.lineage.trim() || null,
    race_traits: isCustomRace(draft.race) && hasRaceTraits(draft.raceTraits) ? draft.raceTraits : null,
    level: draft.level,
    hp_current: draft.hp_current,
    hp_max: draft.hp_max,
    ac: draft.ac,
    speed: draft.speed,
    languages: draft.languages.trim() || null,
    features: draft.features.trim() || null,
    skills: draft.skills,
    str: draft.str,
    dex: draft.dex,
    con: draft.con,
    int: draft.int,
    wis: draft.wis,
    cha: draft.cha,
    updated_at: new Date().toISOString(),
  };

  const write = async (values: Record<string, unknown>) => {
    if (existing) {
      const { data, error } = await supabase
        .from("characters")
        .update(values)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Character;
    }
    const { data, error } = await supabase.from("characters").insert(values).select("*").single();
    if (error) throw error;
    return data as Character;
  };

  try {
    return await write(row);
  } catch (err) {
    const message = String(errorText(err)).toLowerCase();
    // Before migration 20261027000007 the three new columns are missing: save the rest so no
    // edit is lost, then say what is missing.
    if (/subclass|lineage|race_traits/.test(message)) {
      const { subclass: _s, lineage: _l, race_traits: _r, ...rest } = row;
      let saved: Character;
      try {
        saved = await write(rest);
      } catch (inner) {
        throw mapSaveError(inner);
      }
      throw new SheetUpdateNeeded(saved);
    }
    throw mapSaveError(err);
  }
}

function mapSaveError(err: unknown) {
  const message = String(errorText(err)).toLowerCase();
  if (message.includes("ac") || message.includes("speed") || message.includes("skills") || message.includes("features")) {
    return new Error(COMBAT_SQL);
  }
  if (message.includes("level") || message.includes("hp_")) {
    return new Error(SHEET_SQL);
  }
  return err;
}

export async function deleteCharacter(character: Character): Promise<void> {
  const uid = await userId();
  await supabase.storage.from("character-portraits").remove([`${uid}/${character.id}.jpg`]);
  const { error } = await supabase.from("characters").delete().eq("id", character.id);
  if (error) throw error;
}

export async function loadEquipment(characterId: string): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from("character_equipment")
    .select("id, character_id, name, quantity, notes, source")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Equipment[];
}

export async function addEquipment(characterId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the piece of equipment.");
  const { error } = await supabase.from("character_equipment").insert({
    character_id: characterId,
    name: trimmed,
    source: "user",
  });
  if (error) throw error;
}

export async function removeEquipment(id: string): Promise<void> {
  const { error } = await supabase.from("character_equipment").delete().eq("id", id);
  if (error) throw error;
}

export async function loadTraits(characterId: string): Promise<Trait[]> {
  const { data, error } = await supabase
    .from("character_traits")
    .select("id, character_id, name, source")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });
  if (error) {
    if (String(errorText(error)).toLowerCase().includes("character_traits")) return [];
    throw error;
  }
  return (data ?? []) as Trait[];
}

export async function addTrait(characterId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name the trait.");
  const { error } = await supabase.from("character_traits").insert({
    character_id: characterId,
    name: trimmed,
    source: "user",
  });
  if (error) {
    if (String(errorText(error)).toLowerCase().includes("character_traits")) throw new Error(SHEET_SQL);
    throw error;
  }
}

export async function removeTrait(id: string): Promise<void> {
  const { error } = await supabase.from("character_traits").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadPortrait(characterId: string, uri: string): Promise<string> {
  const uid = await userId();
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${uid}/${characterId}.jpg`;
  const { error } = await supabase.storage.from("character-portraits").upload(path, decodeBase64(base64), {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("character-portraits").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const { error: updateError } = await supabase
    .from("characters")
    .update({ portrait_url: url, updated_at: new Date().toISOString() })
    .eq("id", characterId);
  if (updateError) throw updateError;
  return url;
}
