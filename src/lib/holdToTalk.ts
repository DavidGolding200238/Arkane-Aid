import { useCallback, useEffect, useRef, useState } from "react";
import type { ExpoSpeechRecognitionModule as SpeechModuleValue } from "expo-speech-recognition";
import { holdHaptic, tapHaptic } from "./haptics";

// Hold the Sage orb to talk: the phone's own free speech recogniser (expo-speech-recognition,
// Google's on Android) turns speech into text while the orb is held; letting go hands over what
// was heard. No API key and no paid service. The native module only exists in the dev / APK
// build, so it is loaded lazily: anywhere it is missing, holding the orb just explains that.

type SpeechModule = typeof SpeechModuleValue;
type Subscription = { remove: () => void };

let speech: SpeechModule | null | undefined;

function loadSpeech(): SpeechModule | null {
  if (speech === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, so a missing native module never crashes
      speech = (require("expo-speech-recognition") as typeof import("expo-speech-recognition")).ExpoSpeechRecognitionModule ?? null;
    } catch {
      speech = null;
    }
  }
  return speech;
}

// Game words the recogniser would otherwise mishear.
const TERMS = ["Sage", "Scribe", "Codex", "Ledger", "d20", "cantrip", "saving throw", "advantage", "disadvantage", "initiative", "spell slot"];
/** How long to wait for the recogniser's last words after letting go before giving up on them. */
const FINISH_TIMEOUT_MS = 2500;

const MESSAGES = {
  missing: "Voice needs the Arkane Aid app build. Type your question instead.",
  denied: "The Sage can't hear you without the microphone. Hold the orb again to allow it.",
  settings: "The microphone is blocked. Allow it in Settings > Apps > Arkane Aid > Permissions.",
  allowed: "Microphone allowed. Hold the orb and speak.",
  unavailable: "This phone has no speech recogniser. Install or turn on the Google app's voice typing.",
  nothing: "The Sage heard nothing. Hold the orb and speak.",
  network: "The voice service needs a connection. Try again, or type it.",
  busy: "The phone's recogniser is busy. Try again in a moment.",
  failed: "The Sage couldn't hear that. Try again, or type it.",
} as const;

type Heard = { base: string; finals: string[]; interim: string };

/** Only the words heard so far. */
function heardText(h: Heard) {
  return [...h.finals, h.interim].map((part) => part.trim()).filter(Boolean).join(" ");
}

/** What was already typed, then what was heard. */
function fullText(h: Heard) {
  return [h.base, heardText(h)].filter(Boolean).join(" ");
}

type Options = {
  /** What is already in the typing box; what is heard goes after it. */
  getBase: () => string;
  /** False while listening must not start (a reply is on its way). */
  canStart: () => boolean;
  /** Runs just before listening starts: stop the Sage speaking, close the keyboard. */
  onStart: () => void;
  /** The live text (base + what has been heard so far), for the typing box. */
  onTranscript: (text: string) => void;
  /** Let go with something heard: the full text, ready to send. */
  onFinal: (text: string) => void;
  /** Something to tell the player (denied, nothing heard, an error). */
  onMessage: (message: string) => void;
};

export function useHoldToTalk({ getBase, canStart, onStart, onTranscript, onFinal, onMessage }: Options) {
  const [listening, setListening] = useState(false);
  // Latest callbacks, so the native listeners (added once) never call stale ones.
  const handlers = useRef({ getBase, canStart, onStart, onTranscript, onFinal, onMessage });
  useEffect(() => {
    handlers.current = { getBase, canStart, onStart, onTranscript, onFinal, onMessage };
  });

  const held = useRef(false); // the finger is on the orb
  const starting = useRef(false); // permission check / start in progress
  const active = useRef(false); // the recogniser is running
  const sendOnEnd = useRef(false); // let go: hand over the text when the recogniser ends
  const endedWhileHeld = useRef(false); // the recogniser stopped by itself while still held
  const failed = useRef(false);
  const heard = useRef<Heard>({ base: "", finals: [], interim: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const deliver = useCallback(() => {
    clearTimer();
    sendOnEnd.current = false;
    endedWhileHeld.current = false;
    if (!heardText(heard.current)) {
      handlers.current.onMessage(MESSAGES.nothing);
      return;
    }
    handlers.current.onFinal(fullText(heard.current));
  }, []);

  const stopped = useCallback(() => {
    active.current = false;
    setListening(false);
    if (failed.current) {
      clearTimer();
      sendOnEnd.current = false;
      return;
    }
    if (sendOnEnd.current) deliver();
    else if (held.current) endedWhileHeld.current = true; // short recognisers (Android 12 and older) stop on a pause
  }, [deliver]);

  useEffect(() => {
    const mod = loadSpeech();
    if (!mod) return;
    const subs: Subscription[] = [
      mod.addListener("result", (event) => {
        if (!active.current) return;
        const text = event.results[0]?.transcript ?? "";
        if (event.isFinal) {
          if (text.trim()) heard.current.finals.push(text.trim());
          heard.current.interim = "";
        } else {
          heard.current.interim = text;
        }
        handlers.current.onTranscript(fullText(heard.current));
      }),
      mod.addListener("error", (event) => {
        if (event.error === "aborted") return;
        if ((event.error === "no-speech" || event.error === "speech-timeout") && heardText(heard.current)) return; // keep what was heard
        failed.current = true;
        const message =
          event.error === "not-allowed"
            ? MESSAGES.settings
            : event.error === "no-speech" || event.error === "speech-timeout"
              ? MESSAGES.nothing
              : event.error === "network"
                ? MESSAGES.network
                : event.error === "busy"
                  ? MESSAGES.busy
                  : event.error === "service-not-allowed" || event.error === "language-not-supported"
                    ? MESSAGES.unavailable
                    : MESSAGES.failed;
        handlers.current.onMessage(message);
        // What was heard so far stays in the box, unsent, so it can be fixed and sent by hand.
      }),
      mod.addListener("end", () => stopped()),
    ];
    return () => {
      subs.forEach((sub) => sub.remove());
      clearTimer();
      if (active.current) mod.abort();
      active.current = false;
    };
  }, [stopped]);

  /** The orb has been held past the threshold. */
  const start = useCallback(async () => {
    held.current = true;
    if (active.current || starting.current) return;
    const mod = loadSpeech();
    if (!mod) {
      handlers.current.onMessage(MESSAGES.missing);
      return;
    }
    if (!handlers.current.canStart()) return;
    starting.current = true;
    try {
      let permission = await mod.getPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          handlers.current.onMessage(MESSAGES.settings);
          return;
        }
        permission = await mod.requestPermissionsAsync();
        if (!permission.granted) {
          handlers.current.onMessage(permission.canAskAgain ? MESSAGES.denied : MESSAGES.settings);
          return;
        }
        // The permission dialog took the finger off the orb, so this hold is over.
        if (!held.current) {
          handlers.current.onMessage(MESSAGES.allowed);
          return;
        }
      }
      if (!held.current) return; // let go before it was ready: a quick hold, nothing to do
      if (!mod.isRecognitionAvailable()) {
        handlers.current.onMessage(MESSAGES.unavailable);
        return;
      }
      handlers.current.onStart();
      heard.current = { base: handlers.current.getBase().trim(), finals: [], interim: "" };
      failed.current = false;
      sendOnEnd.current = false;
      endedWhileHeld.current = false;
      mod.start({ lang: "en-US", interimResults: true, continuous: true, maxAlternatives: 1, contextualStrings: TERMS });
      active.current = true;
      setListening(true);
      holdHaptic();
    } catch {
      handlers.current.onMessage(MESSAGES.failed);
    } finally {
      starting.current = false;
    }
  }, []);

  /** The finger left the orb (or the press was cancelled). */
  const release = useCallback(() => {
    held.current = false;
    const mod = loadSpeech();
    if (active.current && mod) {
      tapHaptic();
      sendOnEnd.current = true;
      mod.stop(); // the recogniser sends its last words, then "end" hands them over
      clearTimer();
      timer.current = setTimeout(() => {
        if (!active.current) return;
        mod.abort();
        active.current = false;
        setListening(false);
        deliver();
      }, FINISH_TIMEOUT_MS);
    } else if (endedWhileHeld.current) {
      tapHaptic();
      deliver();
    }
  }, [deliver]);

  return { listening, start, release };
}
