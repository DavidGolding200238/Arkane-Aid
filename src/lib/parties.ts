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

const ARCHIVE_SQL = "This needs the latest database update. Run npx supabase db push (migration 20261027000009).";

/** An RPC from migration 20261027000009 that the database doesn't have yet gets a plain explanation. */
export function archiveRpcError(err: unknown) {
  const message = errorText(err);
  return /could not find the function|does not exist/i.test(message) ? new Error(ARCHIVE_SQL) : err;
}

async function partyRpc(name: string, args: Record<string, string>) {
  const { error } = await supabase.rpc(name, args);
  if (error) throw archiveRpcError(error);
}

/** A player leaves: their sheet in the party moves to their Archive. The DM can't leave. */
export function leaveParty(partyId: string) {
  return partyRpc("leave_party", { target: partyId });
}

/** The DM hands the party to another member, who becomes the DM. */
export function transferDm(partyId: string, newDm: string) {
  return partyRpc("transfer_dm", { target: partyId, new_dm: newDm });
}

/** The DM deletes the party: every sheet in it moves to its owner's Archive, then the party,
 *  its chat and its Codex are deleted. */
export function deleteParty(partyId: string) {
  return partyRpc("delete_party", { target: partyId });
}

export type Seat = {
  user_id: string;
  role: MemberRole;
  name: string;
};

export async function myMemberships(): Promise<Membership[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("party_members")
    .select("party_id, user_id, role, parties(id, code, name, created_by, created_at)")
    .eq("user_id", userData.user.id)
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

export async function partySeats(partyId: string): Promise<Seat[]> {
  const { data: members, error } = await supabase
    .from("party_members")
    .select("user_id, role")
    .eq("party_id", partyId);
  if (error) throw error;

  const { data: sheets } = await supabase
    .from("characters")
    .select("user_id, name")
    .eq("party_id", partyId);

  const names = new Map<string, string>();
  for (const sheet of sheets ?? []) {
    const name = String(sheet.name ?? "").trim();
    if (name) names.set(sheet.user_id, name);
  }

  return (members ?? []).map((row) => ({
    user_id: row.user_id,
    role: row.role as MemberRole,
    name: names.get(row.user_id) || "No sheet yet",
  }));
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

