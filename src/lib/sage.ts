import { supabase } from "./supabase";

export type SagePersona = "sage" | "wizard" | "scribe";

export async function askSage(question: string, persona: SagePersona = "sage", sheet = "") {
  const { data, error } = await supabase.functions.invoke("sage", {
    body: { question, persona, sheet },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      const body = await context.json().catch(() => null);
      const detail = body && typeof body === "object" && "error" in body ? body.error : null;
      if (typeof detail === "string" && detail) throw new Error(detail);
    }
    throw error;
  }
  return data as { persona: string; reply: string };
}
