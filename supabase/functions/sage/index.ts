// The Sage, the Scribe and the Bard: one SRD 5.2.1 knowledge base, three voices.
//
// POST { question, mode?: "sage"|"scribe"|"bard", style?: "plain"|"wizard", sheet?, partyId?,
//        history?: [{ q, a }] (last exchanges of this session, at most 3 used) }
//   -> { mode, persona, reply, source, sources: [{ title, citation, page }], corrections, grounded, smallTalk, chat, retrieval, model, busy? }
// `reply` has no citations in it (it is read aloud); `source` is the short footer, e.g. "Alignment, p. 21".
// Retrieval is keyword + meaning search (Supabase.ai gte-small + match_srd); keyword only until seeded.
// Errors -> { error, code } (see _shared/http.ts).
// Needs the GROQ_API_KEY function secret. Players must be signed in.
import { ask } from "../_shared/ask.ts";
import { type Caller, requireUser } from "../_shared/auth.ts";
import { chatWithModel, GroqError } from "../_shared/groq.ts";
import { fail, json, preflight, readJson } from "../_shared/http.ts";
import { semanticSearch } from "../_shared/semantic.ts";

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
      chat: (chatRequest) => chatWithModel(key, chatRequest),
      party: (partyId) => partyContext(caller, partyId),
      semantic: semanticSearch(caller.db),
    });
    if ("error" in result) return fail(result.code === "bad_request" ? 400 : 502, result.code, result.error);
    // Which model wrote each reply ("none" for fixed replies), to trace a bad answer to its model.
    console.log(
      "sage: answered",
      JSON.stringify({ mode: result.mode, model: result.model, retrieval: result.retrieval, busy: !!result.busy }),
    );
    return json(result);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("sage: groq failed", error instanceof GroqError ? error.status : timedOut ? "timeout" : error);
    return fail(
      502,
      "upstream_failed",
      timedOut ? "The Sage took too long. Try again." : "The Sage could not answer just now. Try again.",
    );
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
      const who = [c.name || "Unnamed", c.is_me ? "(the asker)" : "", c.race, c.class, `level ${c.level}`].filter(
        Boolean,
      ).join(" ");
      const bits = [`AC ${c.ac}`, `HP ${c.hp_current}/${c.hp_max}`, `speed ${c.speed}`];
      if (c.skills?.length) bits.push(`skills: ${c.skills.join(", ")}`);
      if (c.traits?.length) bits.push(`traits: ${c.traits.slice(0, 8).join(", ")}`);
      if (c.gear?.length) bits.push(`gear: ${c.gear.slice(0, 10).join(", ")}`);
      return `${who}. ${bits.join("; ")}.`;
    })
    .join("\n")
    .slice(0, 2500);
}
