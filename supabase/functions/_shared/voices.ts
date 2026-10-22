// Google Cloud Text-to-Speech, Chirp 3 HD voices, one per persona. British English to suit
// the table. Any voice can be swapped without a code change with a function secret, e.g.
//   supabase secrets set TTS_VOICE_BARD=en-GB-Chirp3-HD-Fenrir
// Voice list: https://cloud.google.com/text-to-speech/docs/chirp3-hd

export type VoiceKey = "sage" | "wizard" | "scribe" | "bard";

const DEFAULTS: Record<VoiceKey, { name: string; rate: number }> = {
  sage: { name: "en-GB-Chirp3-HD-Charon", rate: 0.95 }, // calm, clear teacher
  wizard: { name: "en-GB-Chirp3-HD-Algenib", rate: 0.9 }, // older, gravelly court mage
  scribe: { name: "en-GB-Chirp3-HD-Kore", rate: 1.0 }, // even, matter-of-fact
  bard: { name: "en-GB-Chirp3-HD-Puck", rate: 1.05 }, // bright and lively
};

const VOICE_NAME = /^[a-z]{2,3}-[A-Z]{2}-Chirp3-HD-[A-Za-z]+$/;

export function isVoiceKey(value: unknown): value is VoiceKey {
  return value === "sage" || value === "wizard" || value === "scribe" || value === "bard";
}

export function voiceFor(key: VoiceKey): { name: string; languageCode: string; rate: number } {
  const override = Deno.env.get(`TTS_VOICE_${key.toUpperCase()}`)?.trim();
  const name = override && VOICE_NAME.test(override) ? override : DEFAULTS[key].name;
  return { name, languageCode: name.split("-").slice(0, 2).join("-"), rate: DEFAULTS[key].rate };
}
