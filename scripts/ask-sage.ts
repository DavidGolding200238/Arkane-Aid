// Try the Sage, Scribe or Bard from a terminal, with the same prompts and SRD search the
// edge function uses. Nothing is deployed.
//
//   deno run -A scripts/ask-sage.ts bard "how much damage does firebal do"
//   deno run -A scripts/ask-sage.ts wizard "can I cast two spells in a turn"
//
// Without GROQ_API_KEY in your shell it prints the request instead of sending it.
// Never put the key in a file in this repo.
import { chat, tidy } from "../supabase/functions/_shared/groq.ts";
import { PERSONAS, resolveMode, systemPrompt } from "../supabase/functions/_shared/personas.ts";
import { srd } from "../supabase/functions/_shared/srd.ts";

const resolved = resolveMode(Deno.args[0] ?? "sage");
if (!resolved) {
  console.error("Use sage, wizard, scribe or bard.");
  Deno.exit(1);
}
const question = Deno.args.slice(1).join(" ") || "What does a critical hit do?";
const persona = PERSONAS[resolved.mode];
const found = srd.search(question, { limit: persona.srdLimit });

console.log(`grounded=${found.grounded}`, found.corrections.length ? found.corrections : "");
for (const hit of found.hits) console.log(`  ${hit.score}  ${hit.citation}`);

const extracts = found.hits.map((hit) => `[${hit.citation}]\n${hit.text}`).join("\n\n") || "No matching SRD 5.2.1 entry.";
const messages = [
  { role: "system" as const, content: systemPrompt(persona.mode, resolved.style) },
  { role: "user" as const, content: `<srd>\n${extracts}\n</srd>\n\nQuestion: ${question}` },
];

const key = Deno.env.get("GROQ_API_KEY");
if (!key) {
  console.log("\nNo GROQ_API_KEY in this shell. The request would be:\n");
  console.log(JSON.stringify({ model: persona.model, messages }, null, 2).slice(0, 3000));
  Deno.exit(0);
}
const reply = tidy(await chat(key, { model: persona.model, temperature: persona.temperature, maxTokens: persona.maxTokens, messages }));
console.log(`\n${persona.name}: ${reply}`);
