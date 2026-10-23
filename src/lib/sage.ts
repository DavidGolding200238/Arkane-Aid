import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Client side of the `sage` edge function (supabase/functions/sage). One SRD 5.2.1 knowledge
// base, three voices. The prompts and the Groq key live only in the function.

/** The two mode buttons on the Sage screen. */
export type SagePersona = "sage" | "scribe";
/** Who answers. "bard" is the Sage's ruling with a witty, musical flourish. */
export type SageMode = "sage" | "scribe" | "bard";
/** How the Sage sounds: "plain" is the Arbiter (short, sure rulings), "wizard" the ornate court mage. */
export type SageStyle = "plain" | "wizard";

export type SageSource = { title: string; citation: string; page: number };

export type SageReply = {
  mode: SageMode;
  persona: string;
  reply: string;
  /** SRD 5.2.1 entries the answer was grounded in. Empty for lore and homebrew answers. */
  sources: SageSource[];
  /** Spelling fixes the search made, e.g. { from: "firebal", to: "Fireball" }. */
  corrections: { from: string; to: string }[];
  /** false when the question was outside the SRD (the reply says "Lore:" or "Homebrew idea:"). */
  grounded: boolean;
  /** "hybrid" (keyword + meaning search), "keyword" (meaning search off or not seeded), "none" (small talk). */
  retrieval?: "hybrid" | "keyword" | "none";
};

/** One earlier exchange in this Sage session, for follow-up questions. In memory only. */
export type SageTurn = { q: string; a: string };

export type SageRequest = {
  question: string;
  mode?: SageMode;
  style?: SageStyle;
  /** The asker's own sheet, short form (see sheetBrief). */
  sheet?: string;
  /** Lets the Sage read the party's sheets for "what can we do" questions. */
  partyId?: string | null;
  /** The last few exchanges of this session (the function uses at most 3, clipped). */
  history?: SageTurn[];
};

export type SageErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_configured"
  | "upstream_failed"
  | "empty_reply"
  | "method_not_allowed"
  | "network";

export class SageError extends Error {
  constructor(message: string, readonly code: SageErrorCode, readonly status = 0) {
    super(message);
    this.name = "SageError";
  }
}

/** Turns a failed function call into one readable SageError. Shared with the voice client. */
async function functionError(error: unknown, fallback: string): Promise<SageError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body = await response.json().catch(() => null);
    const message = typeof body?.error === "string" && body.error ? body.error : fallback;
    const code = typeof body?.code === "string" ? (body.code as SageErrorCode) : "upstream_failed";
    return new SageError(message, code, response.status);
  }
  return new SageError("Could not reach the Sage. Check your connection.", "network");
}

export async function askSage(request: SageRequest): Promise<SageReply> {
  const { data, error } = await supabase.functions.invoke<SageReply>("sage", {
    body: {
      question: request.question,
      mode: request.mode ?? "sage",
      style: request.style ?? "plain",
      sheet: request.sheet ?? "",
      partyId: request.partyId ?? undefined,
      history: (request.history ?? []).slice(-3),
    },
  });
  if (error) throw await functionError(error, "The Sage could not answer just now.");
  if (!data?.reply) throw new SageError("The Sage had nothing to say. Try asking another way.", "empty_reply");
  // Every sage function since the greeting fix answers with smallTalk. Without it the live
  // function is older than this app: redeploy it (npx supabase functions deploy sage).
  if (__DEV__ && typeof (data as { smallTalk?: unknown }).smallTalk !== "boolean") {
    console.warn("Sage: the deployed sage function is out of date. Run: npx supabase functions deploy sage");
  }
  return {
    ...data,
    sources: Array.isArray(data.sources) ? data.sources : [],
    corrections: Array.isArray(data.corrections) ? data.corrections : [],
  };
}
