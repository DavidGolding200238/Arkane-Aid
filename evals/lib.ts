// Shared bits for the Sage evals (search.ts and answers.ts).
import cases from "./sage-eval.json" with { type: "json" };

export type EvalCase = {
  id: string;
  kind: string;
  question: string;
  expect?: string[];
  must_include?: string[][];
  must_not_include?: string[];
  lore?: boolean;
  small_talk?: boolean;
  history_of?: string;
  sheet?: string;
  source?: string[];
  out_of_scope?: boolean;
  /** The structured sheet the app sends with a sheet question (SageScreen sheetData). */
  character?: Record<string, unknown>;
  /** A sheet review: exactly these fields must come back as "fix" findings. */
  fix_fields?: string[];
  /** No Source footer allowed (chat, greetings, a clean sheet's praise). */
  no_source?: boolean;
};

// Help-desk sign-offs break the voice; an in-character offer is fine.
const HELP_DESK = /let me know if|happy to help|feel free to (?:ask|reach)|hope this helps|anything else i can/i;

export const CASES = cases.cases as EvalCase[];
export const TONE_CASES = cases.tone as string[];
export const byId = new Map(CASES.map((c) => [c.id, c]));

export const RESULTS = new URL("./results/", import.meta.url);

export function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

export async function writeResults(name: string, markdown: string, data: unknown): Promise<string> {
  await Deno.mkdir(RESULTS, { recursive: true });
  const base = `${name}-${stamp()}`;
  await Deno.writeTextFile(new URL(`${base}.md`, RESULTS), markdown);
  await Deno.writeTextFile(new URL(`${base}.json`, RESULTS), JSON.stringify(data, null, 2));
  return new URL(`${base}.md`, RESULTS).pathname;
}

export type ReplyCheck = { name: string; pass: boolean; detail?: string };

/** The reply-level checks for one case: must include, must not include, Lore:, small talk. */
export function checkReply(
  c: EvalCase,
  reply: string,
  meta: {
    smallTalk?: boolean;
    sources?: { title: string }[];
    source?: string;
    findings?: { severity: string; field: string }[];
  } = {},
): ReplyCheck[] {
  const text = reply.toLowerCase();
  const checks: ReplyCheck[] = [];
  for (const group of c.must_include ?? []) {
    checks.push({ name: `includes ${group.join(" / ")}`, pass: group.some((g) => text.includes(g.toLowerCase())) });
  }
  for (const bad of c.must_not_include ?? []) {
    checks.push({ name: `avoids ${bad}`, pass: !text.includes(bad.toLowerCase()) });
  }
  // The reply is read aloud: citations belong in the Source footer, never in the text.
  checks.push({ name: "no citation in the spoken text", pass: !/\bSRD\b|\bp\.\s*\d|^\s*sources?:/im.test(reply) });
  checks.push({ name: "no help-desk closer", pass: !HELP_DESK.test(reply) });
  checks.push({ name: "no creature or monster talk about a sheet", pass: !(c.kind === "sheet" && /creature|monster/i.test(reply)) });
  if (c.no_source && meta.source !== undefined) checks.push({ name: "no Source footer", pass: meta.source === "" });
  if (c.fix_fields && meta.findings) {
    const fixes = meta.findings.filter((f) => f.severity === "fix").map((f) => f.field);
    checks.push({ name: `checker fixes ${c.fix_fields.join(", ") || "nothing"}`, pass: fixes.join("|") === c.fix_fields.join("|"), detail: fixes.join(", ") });
  }
  if (c.source?.length && meta.source !== undefined) {
    const note = meta.source.toLowerCase();
    checks.push({ name: `source names ${c.source.join(" / ")}`, pass: c.source.some((s) => note.includes(s.toLowerCase())) });
  }
  if (c.out_of_scope) {
    checks.push({ name: "short decline", pass: reply.trim().length <= 320 && !/^\W*(lore|homebrew idea):/i.test(reply.trim()) });
    if (meta.source !== undefined) checks.push({ name: "no Source footer", pass: meta.source === "" });
  }
  if (c.lore) checks.push({ name: 'starts with "Lore:"', pass: /^\W*lore:/i.test(reply.trim()) });
  if (c.small_talk !== undefined && meta.smallTalk !== undefined) {
    checks.push({ name: `smallTalk is ${c.small_talk}`, pass: meta.smallTalk === c.small_talk });
  }
  return checks;
}
