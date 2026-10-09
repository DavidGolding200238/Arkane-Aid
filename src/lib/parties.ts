import { supabase } from "./supabase";

export type Party = {
  id: string;
  code: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type MemberRole = "dm" | "player";

export type Membership = {
  party_id: string;
  user_id: string;
  role: MemberRole;
  party: Party;
};

export type LedgerEntry = {
  id: string;
  party_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

export function errorText(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : "Request failed.";
}

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

export async function myMemberships(): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("party_members")
    .select("party_id, user_id, role, parties(id, code, name, created_by, created_at)")
    .order("joined_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const party = Array.isArray(row.parties) ? row.parties[0] : row.parties;
    return {
      party_id: row.party_id,
      user_id: row.user_id,
      role: row.role as MemberRole,
      party: party as Party,
    };
  });
}

export async function myProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function addLedgerEntry(partyId: string, body: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not signed in");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("Write a line before saving.");
  if (trimmed.length > 2000) throw new Error("Ledger lines stop at 2000 characters.");

  const { error } = await supabase.from("ledger_entries").insert({
    party_id: partyId,
    author_id: userData.user.id,
    body: trimmed,
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
