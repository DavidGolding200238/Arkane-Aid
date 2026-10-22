import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Client side of the `sage` edge function (supabase/functions/sage). One SRD 5.2.1 knowledge
// base, three voices. The prompts and the Groq key live only in the function.

/** The two mode buttons on the Sage screen. */
export type SagePersona = "sage" | "scribe";
/** Who answers. "bard" is the Sage's ruling with a witty, musical flourish. */
export type SageMode = "sage" | "scribe" | "bard";
/** How the Sage sounds: plain teacher, or ornate court mage ("Wizard" on the Tome). */
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
};

export type SageRequest = {
  question: string;
  mode?: SageMode;
  style?: SageStyle;
  /** The asker's own sheet, short form (see sheetBrief). */
  sheet?: string;
  /** Lets the Sage read the party's sheets for "what can we do" questions. */
  partyId?: string | null;
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
export async function functionError(error: unknown, fallback: string): Promise<SageError> {
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
    },
  });
  if (error) throw await functionError(error, "The Sage could not answer just now.");
  if (!data?.reply) throw new SageError("The Sage had nothing to say. Try asking another way.", "empty_reply");
  return {
    ...data,
    sources: Array.isArray(data.sources) ? data.sources : [],
    corrections: Array.isArray(data.corrections) ? data.corrections : [],
  };
}
