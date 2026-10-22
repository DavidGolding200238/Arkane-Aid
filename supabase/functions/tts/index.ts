// Reads a Sage, Scribe or Bard reply aloud with a Google Chirp 3 HD voice.
//
// POST { text, voice?: "sage"|"wizard"|"scribe"|"bard" }
//   -> { audioContent: base64 MP3, mimeType: "audio/mpeg", voice }
// Errors -> { error, code }. 503 not_configured until GOOGLE_TTS_API_KEY is set; the app then
// falls back to the phone's own voice, so nothing breaks before the Google account exists.
import { requireUser } from "../_shared/auth.ts";
import { fail, json, preflight, readJson, text } from "../_shared/http.ts";
import { isVoiceKey, voiceFor } from "../_shared/voices.ts";

const GOOGLE = "https://texttospeech.googleapis.com/v1/text:synthesize";
// Google allows 5000 bytes per request. Replies are short; this keeps a long one safe and
// keeps the free monthly character allowance going further.
const MAX_CHARS = 1200;

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const caller = await requireUser(request);
  if (!caller) return fail(401, "unauthorized", "Sign in to hear the Sage.");

  const key = Deno.env.get("GOOGLE_TTS_API_KEY");
  if (!key) return fail(503, "not_configured", "Cloud voices are not set up yet.");

  const body = await readJson(request);
  const spoken = text(body.text, MAX_CHARS);
  if (!spoken) return fail(400, "bad_request", "Nothing to read aloud.");
  const voiceKey = isVoiceKey(body.voice) ? body.voice : "sage";
  const voice = voiceFor(voiceKey);

  let response: Response;
  try {
    response = await fetch(`${GOOGLE}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        input: { text: spoken },
        voice: { languageCode: voice.languageCode, name: voice.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: voice.rate },
      }),
    });
  } catch (error) {
    console.error("tts: request failed", error instanceof Error ? error.name : error);
    return fail(502, "upstream_failed", "The voice service did not answer.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.audioContent !== "string") {
    // Log the status only; Google's message can echo the request.
    console.error("tts: google answered", response.status);
    return fail(502, "upstream_failed", "The voice service could not read that.");
  }

  return json({ audioContent: data.audioContent, mimeType: "audio/mpeg", voice: voiceKey });
});
