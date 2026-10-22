import * as Speech from "expo-speech";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { supabase } from "./supabase";
import { functionError } from "./sage";

// Reading replies aloud. First choice: a Google Chirp 3 HD voice per persona, through the
// `tts` edge function (the Google key stays in Supabase). If that is not set up yet, fails,
// or the phone is offline, the phone's own voice (expo-speech) reads it instead. Both work
// in Expo Go and in a development build.

/** Who is speaking. Each has its own cloud voice (supabase/functions/_shared/voices.ts). */
export type SpeakerVoice = "sage" | "wizard" | "scribe" | "bard";

type Handlers = {
  /** Runs however the speech stops: finished, stopped or failed. */
  onEnd: () => void;
  /** Runs only when it reached the end on its own. */
  onDone?: () => void;
};

// Device voice settings, kept from the first version of the Sage screen.
const DEVICE_RATE: Record<SpeakerVoice, number> = { sage: 0.92, wizard: 0.86, scribe: 0.95, bard: 0.98 };
// The cloud voices speak a little slower than device voices at the same rate.
const CLOUD_WORDS_PER_SECOND = 2.6;
const DEVICE_WORDS_PER_SECOND = 2.9;

// Off for the rest of the session once the function says it is not configured, or after two
// failures in a row, so nobody waits on a voice that will not come.
let cloudEnabled = true;
let cloudFailures = 0;
let player: AudioPlayer | null = null;
let finishTimer: ReturnType<typeof setTimeout> | null = null;
let current: Handlers | null = null;
let generation = 0;
let audioModeSet = false;
const cache = new Map<string, string>();
let clip = 0;

/** Words per second the reply will be read at, so the quill can keep pace. */
export function speechPace(voice: SpeakerVoice): number {
  return cloudEnabled ? CLOUD_WORDS_PER_SECOND : DEVICE_WORDS_PER_SECOND * DEVICE_RATE[voice];
}

export function stopSpeaking() {
  generation += 1;
  Speech.stop();
  releasePlayer();
  const handlers = current;
  current = null;
  handlers?.onEnd();
}

export async function speak(text: string, voice: SpeakerVoice, handlers: Handlers) {
  stopSpeaking();
  const mine = ++generation;
  current = handlers;
  if (cloudEnabled) {
    const played = await playCloud(text, voice, mine);
    if (played || mine !== generation) return;
  }
  if (mine !== generation) return;
  speakOnDevice(text, voice, mine);
}

function finish(mine: number, reachedEnd: boolean) {
  if (mine !== generation) return;
  const handlers = current;
  current = null;
  releasePlayer();
  handlers?.onEnd();
  if (reachedEnd) handlers?.onDone?.();
}

function releasePlayer() {
  if (finishTimer) clearTimeout(finishTimer);
  finishTimer = null;
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // already released
    }
    player = null;
  }
}

async function playCloud(text: string, voice: SpeakerVoice, mine: number): Promise<boolean> {
  try {
    const uri = await cloudAudio(text, voice);
    if (mine !== generation) return true;
    if (!audioModeSet) {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
      audioModeSet = true;
    }
    const next = createAudioPlayer({ uri });
    player = next;
    next.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) finish(mine, true);
    });
    next.play();
    // Safety net: if the finish event never comes, end after the clip's length plus a margin.
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    finishTimer = setTimeout(() => finish(mine, true), (words / 1.5 + 5) * 1000);
    cloudFailures = 0;
    return true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    cloudFailures += 1;
    if (code === "not_configured" || code === "unauthorized" || cloudFailures >= 2) cloudEnabled = false;
    releasePlayer();
    return false;
  }
}

async function cloudAudio(text: string, voice: SpeakerVoice): Promise<string> {
  const key = `${voice}:${text}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { data, error } = await supabase.functions.invoke<{ audioContent: string }>("tts", { body: { text, voice } });
  if (error) throw await functionError(error, "The voice could not be loaded.");
  if (!data?.audioContent) throw new Error("No audio came back.");
  const file = new File(Paths.cache, `sage-voice-${clip++ % 8}.mp3`);
  file.create({ overwrite: true });
  file.write(data.audioContent, { encoding: "base64" });
  // Only the last few clips are kept; older cache names get reused above.
  for (const [oldKey, uri] of cache) if (uri === file.uri) cache.delete(oldKey);
  cache.set(key, file.uri);
  return file.uri;
}

// ---- Device voice (expo-speech) ----

let wizardVoice: string | null = null;

function scoreVoice(voice: { identifier?: string; name?: string; language?: string }) {
  const id = `${voice.identifier ?? ""} ${voice.name ?? ""}`.toLowerCase();
  const lang = (voice.language ?? "").toLowerCase();
  if (!lang.startsWith("en")) return -1;
  if (/female|woman|samantha|victoria|karen|moira|tessa/.test(id)) return 0;
  let score = 1;
  if (/male|man|daniel|fred|rjs|iom|alex|bruce|ralph|gordon|arthur/.test(id)) score += 4;
  if (/en-gb|en_gb|british|uk/.test(id) || lang.startsWith("en-gb")) score += 2;
  if (/old|deep|low/.test(id)) score += 2;
  return score;
}

/** Picks the deepest, oldest-sounding English device voice for the Wizard. Safe to call early. */
export async function prepareDeviceVoices() {
  if (wizardVoice !== null) return;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const ranked = voices
      .map((voice) => ({ voice, score: scoreVoice(voice) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    wizardVoice = ranked[0]?.voice.identifier ?? "";
  } catch {
    wizardVoice = "";
  }
}

function speakOnDevice(text: string, voice: SpeakerVoice, mine: number) {
  Speech.speak(text, {
    language: "en",
    rate: DEVICE_RATE[voice],
    pitch: voice === "bard" ? 1.05 : 1,
    voice: voice === "wizard" && wizardVoice ? wizardVoice : undefined,
    onDone: () => finish(mine, true),
    onStopped: () => finish(mine, false),
    onError: () => finish(mine, false),
  });
}
