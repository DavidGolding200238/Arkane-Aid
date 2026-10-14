import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";
import { errorText } from "./parties";

export type Character = {
  id: string;
  user_id: string;
  party_id: string | null;
  name: string;
  class: string | null;
  race: string | null;
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

const SHEET_SQL =
  "Run supabase/003_level_hp_traits.sql in the SQL editor once. It adds level, HP, and the traits list.";
const COMBAT_SQL =
  "Run supabase/004_sheet_combat.sql in the SQL editor once. It adds armor class, speed, skills, languages, and features.";

const SHEET_WORDS =
  /\b(my|mine|me|i|i'm|im|character|sheet|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha|class|race|species|gear|equipment|trait|traits|background|inventory|level|hp|hit|ac|armor|speed|skill|language|spell|feature|can i|do i|am i)\b/i;

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
  };
}

export function needsSheet(question: string) {
  return SHEET_WORDS.test(question);
}

export function sheetBrief(character: Character | null, gear: Equipment[], traits: Trait[] = []): string {
  if (!character) return "";
  const name = clip(character.name, 24) || "Unnamed";
  const race = clip(character.race, 16);
  const klass = clip(character.class, 16);
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
  return [
    who,
    combat,
    stats,
    skills ? `Skills: ${skills}` : "",
    gearLine ? `Gear: ${gearLine}` : "",
    traitLine ? `Traits: ${traitLine}` : "",
    features ? `Features: ${features}` : "",
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

  try {
    if (existing) {
      const { data, error } = await supabase
        .from("characters")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Character;
    }
    const { data, error } = await supabase.from("characters").insert(row).select("*").single();
    if (error) throw error;
    return data as Character;
  } catch (err) {
    const message = String(errorText(err)).toLowerCase();
    if (message.includes("ac") || message.includes("speed") || message.includes("skills") || message.includes("features")) {
      throw new Error(COMBAT_SQL);
    }
    if (message.includes("level") || message.includes("hp_")) {
      throw new Error(SHEET_SQL);
    }
    throw err;
  }
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
