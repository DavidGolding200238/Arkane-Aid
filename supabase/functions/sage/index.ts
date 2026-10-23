// The Sage, the Scribe and the Bard: one SRD 5.2.1 knowledge base, three voices.
//
// POST { question, mode?: "sage"|"scribe"|"bard", style?: "plain"|"wizard", sheet?, partyId? }
//   -> { mode, persona, reply, sources: [{ title, citation, page }], corrections, grounded, smallTalk }
// Errors -> { error, code } (see _shared/http.ts).
// Needs the GROQ_API_KEY function secret. Players must be signed in.
import { ask } from "../_shared/ask.ts";
import { requireUser, type Caller } from "../_shared/auth.ts";
import { chat, GroqError } from "../_shared/groq.ts";
import { fail, json, preflight, readJson } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const caller = await requireUser(request);
  if (!caller) return fail(401, "unauthorized", "Sign in to ask the Sage.");

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return fail(503, "not_configured", "The Sage is not set up yet (GROQ_API_KEY is missing).");

  const body = await readJson(request);
  try {
    const result = await ask(body, {
      chat: (chatRequest) => chat(key, chatRequest),
      party: (partyId) => partyContext(caller, partyId),
    });
    if ("error" in result) return fail(result.code === "bad_request" ? 400 : 502, result.code, result.error);
    return json(result);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("sage: groq failed", error instanceof GroqError ? error.status : timedOut ? "timeout" : error);
    return fail(502, "upstream_failed", timedOut ? "The Sage took too long. Try again." : "The Sage could not answer just now. Try again.");
  }
});

type PartySheet = {
  name: string;
  class: string | null;
  race: string | null;
  level: number;
  hp_current: number;
  hp_max: number;
  ac: number;
  speed: number;
  skills: string[] | null;
  traits: string[] | null;
  gear: string[] | null;
  is_me: boolean;
};

/** The party's sheets, read as the player (RLS + party_sheets only return their own party). */
async function partyContext(caller: Caller, partyId: string): Promise<string> {
  const { data, error } = await caller.db.rpc("party_sheets", { target: partyId });
  if (error || !Array.isArray(data)) {
    if (error) console.error("sage: party_sheets failed", error.code);
    return "";
  }
  return (data as PartySheet[])
    .map((c) => {
      const who = [c.name || "Unnamed", c.is_me ? "(the asker)" : "", c.race, c.class, `level ${c.level}`].filter(Boolean).join(" ");
      const bits = [`AC ${c.ac}`, `HP ${c.hp_current}/${c.hp_max}`, `speed ${c.speed}`];
      if (c.skills?.length) bits.push(`skills: ${c.skills.join(", ")}`);
      if (c.traits?.length) bits.push(`traits: ${c.traits.slice(0, 8).join(", ")}`);
      if (c.gear?.length) bits.push(`gear: ${c.gear.slice(0, 10).join(", ")}`);
      return `${who}. ${bits.join("; ")}.`;
    })
    .join("\n")
    .slice(0, 2500);
}
