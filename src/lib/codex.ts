import { supabase } from "./supabase";

export type CodexKind = "note" | "item" | "event";

export type CodexEntry = {
  id: string;
  party_id: string;
  author_id: string;
  kind: CodexKind;
  title: string | null;
  body: string;
  source: "user" | "scribe";
  created_at: string;
};

export async function loadCodex(partyId: string): Promise<CodexEntry[]> {
  const { data, error } = await supabase
    .from("codex_entries")
    .select("id, party_id, author_id, kind, title, body, source, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CodexEntry[];
}

export async function addCodexEntry(
  partyId: string,
  kind: CodexKind,
  title: string,
  body: string
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not signed in");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Write something before saving.");
  if (trimmed.length > 4000) throw new Error("Codex entries stop at 4000 characters.");

  const { error } = await supabase.from("codex_entries").insert({
    party_id: partyId,
    author_id: userData.user.id,
    kind,
    title: title.trim() || null,
    body: trimmed,
    source: "user",
  });
  if (error) throw error;
}

export async function removeCodexEntry(id: string): Promise<void> {
  const { error } = await supabase.from("codex_entries").delete().eq("id", id);
  if (error) throw error;
}
