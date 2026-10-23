import * as Speech from "expo-speech";

// Reading replies aloud with the phone's own free text to speech (expo-speech). No paid
// service and no network call. Works in Expo Go and in a development build.

/** Who is speaking. Each gets its own device voice, rate and pitch so they sound different. */
export type SpeakerVoice = "sage" | "wizard" | "scribe" | "bard";

type Handlers = {
  /** Runs however the speech stops: finished, stopped or failed. */
  onEnd: () => void;
  /** Runs only when it reached the end on its own. */
  onDone?: () => void;
};

type DeviceVoice = { identifier?: string; name?: string; language?: string; quality?: string };

// Rate and pitch per persona: the Wizard slow and low, the Bard brighter, the Scribe even.
const TUNING: Record<SpeakerVoice, { rate: number; pitch: number }> = {
  sage: { rate: 0.92, pitch: 1 },
  wizard: { rate: 0.86, pitch: 0.9 },
  scribe: { rate: 0.95, pitch: 1 },
  bard: { rate: 0.98, pitch: 1.05 },
};
const WORDS_PER_SECOND = 2.9;

let current: Handlers | null = null;
let generation = 0;

/** Words per second the reply will be read at, so the quill can keep pace. */
export function speechPace(voice: SpeakerVoice): number {
  return WORDS_PER_SECOND * TUNING[voice].rate;
}

export function stopSpeaking() {
  generation += 1;
  Speech.stop();
  const handlers = current;
  current = null;
  handlers?.onEnd();
}

export function speak(text: string, voice: SpeakerVoice, handlers: Handlers) {
  stopSpeaking();
  const mine = ++generation;
  current = handlers;
  const { rate, pitch } = TUNING[voice];
  Speech.speak(text, {
    language: "en",
    rate,
    pitch,
    voice: picked?.[voice] || undefined,
    onDone: () => finish(mine, true),
    onStopped: () => finish(mine, false),
    onError: () => finish(mine, false),
  });
}

function finish(mine: number, reachedEnd: boolean) {
  if (mine !== generation) return;
  const handlers = current;
  current = null;
  handlers?.onEnd();
  if (reachedEnd) handlers?.onDone?.();
}

// ---- Choosing a device voice per persona ----
// Voice names differ by phone (Android: "en-gb-x-rjs-local", iOS: "Daniel"), so this only
// nudges the choice: English first, offline and enhanced voices preferred, and each persona
// leans towards a different accent or voice so they do not all sound alike. If nothing
// matches, the phone's default English voice is used.

let picked: Record<SpeakerVoice, string> | null = null;

const MALE = /\bmale\b|daniel|fred|rjs|iom|alex|bruce|ralph|gordon|arthur|aaron|oliver|tom\b/;
const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|serena|kate|fis|gba|sfg|tpc/;
const GB = /en-gb|en_gb|british|\buk\b/;

function base(voice: DeviceVoice) {
  const lang = (voice.language ?? "").toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return null;
  const id = `${voice.identifier ?? ""} ${voice.name ?? ""}`.toLowerCase();
  let score = 1;
  if (voice.quality === "Enhanced") score += 1;
  if (/local/.test(id) && !/network/.test(id)) score += 1; // works offline
  return { id, lang, score };
}

const PREFERENCE: Record<SpeakerVoice, (id: string, lang: string) => number> = {
  // Older, deeper court mage: male, British, "deep/old" if the phone names it so.
  wizard: (id, lang) => (MALE.test(id) ? 4 : FEMALE.test(id) ? -3 : 0) + (GB.test(id) || lang.startsWith("en-gb") ? 2 : 0) + (/old|deep|low/.test(id) ? 2 : 0),
  // Calm teacher: British or neutral English.
  sage: (id, lang) => (GB.test(id) || lang.startsWith("en-gb") ? 2 : 0) + (MALE.test(id) ? 1 : 0),
  // Even record-keeper: a different-sounding (often female) voice.
  scribe: (id) => (FEMALE.test(id) ? 3 : 0),
  // Lively minstrel: a lighter accent where available (Irish, Australian, US).
  bard: (id, lang) => (/en-ie|en-au|irish|austral/.test(id) || /en-(ie|au)/.test(lang) ? 3 : lang.startsWith("en-us") ? 1 : 0),
};

/** Picks a device voice for each persona. Safe to call early; runs once. */
export async function prepareDeviceVoices() {
  if (picked) return;
  const choice: Record<SpeakerVoice, string> = { sage: "", wizard: "", scribe: "", bard: "" };
  try {
    const voices = (await Speech.getAvailableVoicesAsync()) as DeviceVoice[];
    const english = voices.map((v) => ({ v, b: base(v) })).filter((row) => row.b && row.v.identifier);
    const used = new Set<string>();
    for (const persona of ["wizard", "sage", "scribe", "bard"] as SpeakerVoice[]) {
      let best: { id: string; score: number } | null = null;
      for (const { v, b } of english) {
        if (!b || !v.identifier) continue;
        // Prefer a voice no other persona has taken yet.
        const score = b.score + PREFERENCE[persona](b.id, b.lang) - (used.has(v.identifier) ? 3 : 0);
        if (!best || score > best.score) best = { id: v.identifier, score };
      }
      if (best && best.score > 0) {
        choice[persona] = best.id;
        used.add(best.id);
      }
    }
  } catch {
    // Keep the default voice for everyone.
  }
  picked = choice;
}
