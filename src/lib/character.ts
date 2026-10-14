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
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  portrait_url: string | null;
  traits: string | null;
};

export type Equipment = {
  id: string;
  character_id: string;
  name: string;
  quantity: number;
  notes: string | null;
  source: "user" | "scribe";
};

export type CharacterDraft = {
  name: string;
  class: string;
  race: string;
  background: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  traits: string;
};

const TRAITS_SQL =
  "alter table public.characters add column if not exists traits text;";

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
  return (data?.[0] as Character | undefined) ?? null;
}

export function sheetBrief(character: Character | null, gear: Equipment[]): string {
  if (!character) return "";
  const gearLine = gear.length ? gear.map((item) => item.name).join(", ") : "none";
  return [
    `Name: ${character.name || "Unnamed"}`,
    `Race: ${character.race || "unknown"}`,
    `Class: ${character.class || "unknown"}`,
    `STR ${character.str} DEX ${character.dex} CON ${character.con} INT ${character.int} WIS ${character.wis} CHA ${character.cha}`,
    character.background ? `Background: ${character.background}` : "",
    character.traits ? `Traits: ${character.traits}` : "",
    `Equipment: ${gearLine}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function writeCharacter(
  partyId: string | null,
  draft: CharacterDraft,
  existing: Character | null,
  withTraits: boolean
) {
  const uid = await userId();
  const row = {
    user_id: uid,
    party_id: partyId,
    name: draft.name.trim(),
    class: draft.class.trim() || null,
    race: draft.race.trim() || null,
    background: draft.background.trim() || null,
    str: draft.str,
    dex: draft.dex,
    con: draft.con,
    int: draft.int,
    wis: draft.wis,
    cha: draft.cha,
    updated_at: new Date().toISOString(),
    ...(withTraits ? { traits: draft.traits.trim() || null } : {}),
  };

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
}

export async function saveCharacter(
  partyId: string | null,
  draft: CharacterDraft,
  existing: Character | null
): Promise<Character> {
  try {
    return await writeCharacter(partyId, draft, existing, true);
  } catch (err) {
    if (!String(errorText(err)).toLowerCase().includes("traits")) throw err;
    await writeCharacter(partyId, draft, existing, false);
    throw new Error(`Sheet saved except traits. Run this once in the SQL editor: ${TRAITS_SQL}`);
  }
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
