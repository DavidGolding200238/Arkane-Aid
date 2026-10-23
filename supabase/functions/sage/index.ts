// The Sage, the Scribe and the Bard: one SRD 5.2.1 knowledge base, three voices.
//
// POST { question, mode?: "sage"|"scribe"|"bard", style?: "plain"|"wizard", sheet?, partyId? }
//   -> { mode, persona, reply, sources: [{ title, citation, page }], corrections, grounded, smallTalk }
// Errors -> { error, code } (see _shared/http.ts).
// Needs the GROQ_API_KEY function secret. Players must be signed in.
import { requireUser, type Caller } from "../_shared/auth.ts";
import { chat, GroqError, tidy } from "../_shared/groq.ts";
import { fail, json, preflight, readJson, text } from "../_shared/http.ts";
import { PERSONAS, resolveMode, systemPrompt, type SageStyle } from "../_shared/personas.ts";
import { userMessage } from "../_shared/message.ts";
import { isSmallTalk } from "../_shared/smalltalk.ts";
import { srd } from "../_shared/srd.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Questions that are about the table as a whole get the party's sheets as context.
const ABOUT_PARTY = /\b(party|we|our|us|everyone|everybody|anyone|anybody|who|group|team|together|all of)\b/i;

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const caller = await requireUser(request);
  if (!caller) return fail(401, "unauthorized", "Sign in to ask the Sage.");

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return fail(503, "not_configured", "The Sage is not set up yet (GROQ_API_KEY is missing).");

  const body = await readJson(request);
  const resolved = resolveMode(body.mode ?? body.persona);
  if (!resolved) return fail(400, "bad_request", "Unknown mode. Use sage, scribe or bard.");
  const persona = PERSONAS[resolved.mode];
  const style: SageStyle = resolved.style ?? (body.style === "wizard" ? "wizard" : "plain");

  const question = text(body.question, 1500);
  if (!question) return fail(400, "bad_request", "Ask a question first.");
  const sheet = text(body.sheet, 2000);
  const partyId = typeof body.partyId === "string" && UUID.test(body.partyId) ? body.partyId : null;

  // A message that is only a greeting or "thanks" is answered in character without searching
  // the SRD (a fuzzy search on "Hello" only finds noise). Anything with a question in it is searched.
  const found = isSmallTalk(question) ? null : srd.search(question, { limit: persona.srdLimit });
  const party = found && partyId && ABOUT_PARTY.test(question) ? await partyContext(caller, partyId) : "";

  let reply: string;
  try {
    reply = tidy(
      await chat(key, {
        model: persona.model,
        temperature: persona.temperature,
        maxTokens: persona.maxTokens,
        messages: [
          { role: "system", content: systemPrompt(persona.mode, style) },
          { role: "user", content: userMessage(question, found, found ? sheet : "", party) },
        ],
      }),
    );
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("sage: groq failed", error instanceof GroqError ? error.status : timedOut ? "timeout" : error);
    return fail(502, "upstream_failed", timedOut ? "The Sage took too long. Try again." : "The Sage could not answer just now. Try again.");
  }
  if (!reply) return fail(502, "empty_reply", "The Sage had nothing to say. Try asking another way.");

  return json({
    mode: persona.mode,
    persona: persona.name,
    reply,
    sources: found?.hits.map((hit) => ({ title: hit.title, citation: hit.citation, page: hit.page })) ?? [],
    corrections: found?.corrections ?? [],
    grounded: found?.grounded ?? false,
    smallTalk: !found,
  });
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
