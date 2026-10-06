import { supabase } from "./supabase";

export type SagePersona = "sage" | "scribe";

export async function askSage(question: string, persona: SagePersona = "sage") {
  const { data, error } = await supabase.functions.invoke("sage", {
    body: { question, persona },
  });
  if (error) throw error;
  return data as { persona: string; reply: string };
}
