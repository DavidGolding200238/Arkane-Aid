import { supabase } from "./supabase";

export type Party = {
  id: string;
  code: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type LedgerEntry = {
  id: string;
  party_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export async function createParty(name: string): Promise<Party> {
  const { data, error } = await supabase.rpc("create_party", { party_name: name });
  if (error) throw error;
  return data as Party;
}

export async function joinParty(code: string): Promise<Party> {
  const { data, error } = await supabase.rpc("join_party", { join_code: code });
  if (error) throw error;
  return data as Party;
}

export async function myParties(): Promise<Party[]> {
  const { data, error } = await supabase
    .from("parties")
    .select("id, code, name, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Party[];
}

export async function addLedgerEntry(partyId: string, body: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not signed in");

  const { error } = await supabase.from("ledger_entries").insert({
    party_id: partyId,
    author_id: userData.user.id,
    body: body.trim(),
  });
  if (error) throw error;
}

export async function partyLedger(partyId: string): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, party_id, author_id, body, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LedgerEntry[];
}
