// Answer eval: asks the Sage every question in sage-eval.json and scores the replies.
//
//   npm run eval:answers                      deployed sage function, Arbiter voice
//   npm run eval:answers -- --voice wizard    another voice (wizard, arbiter, bard)
//   npm run eval:answers -- --tone            also 3 questions in each of the three voices
//   npm run eval:answers -- --local           no deploy: same code path on this computer, Groq direct
//   npm run eval:answers -- --rpm 2 --only typo-fireball,lore-hells
//
// Deployed mode needs, in your shell only (never in a file in this repo):
//   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
//   and SAGE_EVAL_TOKEN (a test player's access token) or SAGE_EVAL_EMAIL + SAGE_EVAL_PASSWORD
//   (a test account; the password only goes to Supabase Auth over HTTPS and is never printed).
// Local mode needs GROQ_API_KEY. It uses meaning search from .cache/ (run npm run eval:search once).
//
// Groq free tier for gpt-oss-120b: 30 requests/min but only 8K tokens/min, and one Sage request
// is about 1.5-2.5K tokens (prompt, SRD extracts, history, reply), so the default pace is 3/min.
// A 429 waits (Retry-After, or 20 s, 40 s, 80 s) and tries again.
import { createClient } from "npm:@supabase/supabase-js@2";
import { ask, type AskReply } from "../supabase/functions/_shared/ask.ts";
import { GroqError, once } from "../supabase/functions/_shared/groq.ts";
import type { Turn } from "../supabase/functions/_shared/history.ts";
import { cleanTitle } from "../supabase/functions/_shared/retrieval.ts";
import { byId, CASES, checkReply, type EvalCase, type ReplyCheck, TONE_CASES, writeResults } from "./lib.ts";

const VOICES: Record<string, { mode: string; style: string }> = {
  wizard: { mode: "sage", style: "wizard" },
  arbiter: { mode: "sage", style: "plain" },
  bard: { mode: "bard", style: "plain" },
};

function flag(name: string): string | undefined {
  const i = Deno.args.indexOf(`--${name}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}
const local = Deno.args.includes("--local");
const tone = Deno.args.includes("--tone");
const voice = flag("voice") ?? "arbiter";
const rpm = Number(flag("rpm") ?? 3);
const only = flag("only")?.split(",");
if (!VOICES[voice]) throw new Error(`--voice must be one of ${Object.keys(VOICES).join(", ")}`);
if (!(rpm > 0 && rpm <= 10)) throw new Error("--rpm must be between 1 and 10 (Groq free tier: 8K tokens/min).");

class RateLimited extends Error {
  constructor(readonly retryAfter?: number) {
    super("rate limited");
  }
}

type Asker = (body: Record<string, unknown>) => Promise<AskReply>;

async function deployedAsker(): Promise<Asker> {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (the publishable key), or use --local.");
  let token = Deno.env.get("SAGE_EVAL_TOKEN");
  if (!token) {
    const email = Deno.env.get("SAGE_EVAL_EMAIL");
    const password = Deno.env.get("SAGE_EVAL_PASSWORD");
    if (!email || !password) throw new Error("Set SAGE_EVAL_TOKEN, or SAGE_EVAL_EMAIL and SAGE_EVAL_PASSWORD for a test account.");
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error("Test account sign-in failed (check the email and password).");
    token = data.session.access_token;
  }
  return async (body) => {
    const response = await fetch(`${url}/functions/v1/sage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    // The function turns a Groq 429 into 502 upstream_failed; treat both as "slow down".
    if (response.status === 429 || data?.code === "upstream_failed") {
      throw new RateLimited(Number(response.headers.get("retry-after")) || undefined);
    }
    if (!response.ok) throw new Error(`sage answered ${response.status}: ${data?.error ?? "no body"}`);
    return data as AskReply;
  };
}

async function localAsker(): Promise<Asker> {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("--local needs GROQ_API_KEY in your shell (never in a file).");
  let semantic: ((text: string) => Promise<{ chunk: number; name: string; similarity: number }[]>) | undefined;
  try {
    const { buildCache, loadEmbedder } = await import("../scripts/srd-embed.ts");
    const embed = await loadEmbedder();
    const cache = await buildCache(embed);
    semantic = async (text) => {
      const [q] = await embed([text]);
      const best = new Map<number, { chunk: number; name: string; similarity: number }>();
      for (const p of cache.pieces) {
        const similarity = p.embedding.reduce((s, v, i) => s + v * q[i], 0);
        const seen = best.get(p.chunk);
        if (!seen || similarity > seen.similarity) best.set(p.chunk, { chunk: p.chunk, name: p.name, similarity });
      }
      return [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 8);
    };
  } catch (error) {
    console.warn("Meaning search unavailable locally, keyword only:", error instanceof Error ? error.message : error);
  }
  return async (body) => {
    try {
      const result = await ask(body, { chat: (request) => once(key, request), party: () => Promise.resolve(""), semantic });
      if ("error" in result) throw new Error(result.error);
      return result;
    } catch (error) {
      if (error instanceof GroqError && error.status === 429) throw new RateLimited();
      throw error;
    }
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withBackoff(asker: Asker, body: Record<string, unknown>): Promise<AskReply> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await asker(body);
    } catch (error) {
      if (!(error instanceof RateLimited) || attempt >= 3) throw error;
      const wait = (error.retryAfter ?? 20 * 2 ** attempt) * 1000;
      console.log(`  rate limited, waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

type Result = { id: string; voice: string; question: string; reply: string; source?: string; sources: string[]; retrieval?: string; checks: ReplyCheck[]; pass: boolean; error?: string };

let asker: Asker;
try {
  asker = local ? await localAsker() : await deployedAsker();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  Deno.exit(1);
}
const plan: { c: EvalCase; voice: string }[] = CASES.filter((c) => !only || only.includes(c.id)).map((c) => ({ c, voice }));
if (tone) {
  for (const v of Object.keys(VOICES)) {
    for (const id of TONE_CASES) if (v !== voice && byId.has(id)) plan.push({ c: byId.get(id)!, voice: v });
  }
}
console.log(`${plan.length} requests at ${rpm}/min (about ${Math.ceil(plan.length / rpm)} min), ${local ? "local" : "deployed"}.`);

const replies = new Map<string, string>();
const results: Result[] = [];
const gap = 60_000 / rpm;
for (const [n, { c, voice: v }] of plan.entries()) {
  const started = Date.now();
  const previous = c.history_of ? byId.get(c.history_of) : undefined;
  const history: Turn[] = previous && replies.has(`${v}:${previous.id}`)
    ? [{ q: previous.question, a: replies.get(`${v}:${previous.id}`)! }]
    : [];
  try {
    const body = { question: c.question, ...VOICES[v], history, sheet: c.sheet ?? "", ...(c.character ? { character: c.character } : {}) };
    const r = await withBackoff(asker, body);
    replies.set(`${v}:${c.id}`, r.reply);
    const checks = checkReply(c, r.reply, { smallTalk: r.smallTalk, source: r.source ?? "", findings: r.findings });
    if (c.expect?.length) {
      const want = c.expect.map(cleanTitle);
      checks.push({ name: `cites ${want.join(" / ")}`, pass: r.sources.some((s) => want.includes(s.title)) });
    }
    if (c.history_of) checks.push({ name: "sent with history", pass: history.length > 0 });
    results.push({
      id: c.id,
      voice: v,
      question: c.question,
      reply: r.reply,
      source: r.source,
      sources: r.sources.map((s) => s.citation),
      retrieval: r.retrieval,
      checks,
      pass: checks.every((x) => x.pass),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ id: c.id, voice: v, question: c.question, reply: "", sources: [], checks: [], pass: false, error: message });
  }
  const last = results[results.length - 1];
  console.log(`${n + 1}/${plan.length} ${last.pass ? "PASS" : "FAIL"} [${v}] ${c.id}${last.error ? ` (${last.error})` : ""}`);
  if (n < plan.length - 1) await sleep(Math.max(0, gap - (Date.now() - started)));
}

const passed = results.filter((r) => r.pass).length;
const checks = results.flatMap((r) => r.checks);
const md = [
  `# Sage answer eval`,
  "",
  `${new Date().toISOString()} · ${local ? "local (Groq direct)" : "deployed function"} · voice ${voice}${tone ? " + tone" : ""}`,
  "",
  `**${passed}/${results.length} questions passed**, ${checks.filter((c) => c.pass).length}/${checks.length} checks.`,
  `Retrieval: ${[...new Set(results.map((r) => r.retrieval ?? "?"))].join(", ")}.`,
  "",
  "| Case | Voice | Result | Failed checks |",
  "| --- | --- | --- | --- |",
  ...results.map((r) =>
    `| ${r.id} | ${r.voice} | ${r.pass ? "✅" : "❌"} | ${r.error ?? r.checks.filter((c) => !c.pass).map((c) => c.name).join("; ")} |`
  ),
  "",
  "## Replies",
  "",
  ...results.flatMap((r) => [`### ${r.id} (${r.voice})`, "", `> ${r.question}`, "", r.reply || `_${r.error}_`, "", ...(r.source ? [`_Source: ${r.source}_`, ""] : []), ...r.sources.map((s) => `- ${s}`), ""]),
];
const path = await writeResults(`answers-${voice}${tone ? "-tone" : ""}`, md.join("\n"), { passed, total: results.length, results });
console.log(`\n${passed}/${results.length} passed. Scorecard: ${path}`);
