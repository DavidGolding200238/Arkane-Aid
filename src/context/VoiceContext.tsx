import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Storage from "expo-sqlite/kv-store";

// The Sage's personality, picked on the Tome screen and read by the Sage screen.
// - Wizard: the Sage in an ornate court-mage style (style "wizard"), red fire, a slow low device voice.
// - Arbiter: the table's judge, short and direct (persona "sage", style "plain"), blue fire, a calm device voice.
//   Its saved id stays "plain" so choices saved before the rename keep working.
// - Bard:   the Bard persona (mode "bard"), a ruling with a rhyme, green fire, a brighter device voice.
// The facts rules are the same for all three; only the tone and voice change.
// Stored on the device (expo-sqlite key-value store, already used by the Supabase
// session), not in the database.

export type VoiceId = "wizard" | "plain" | "bard";

export type VoiceOption = {
  id: VoiceId;
  label: string;
  /** Orb colour in the Figma Sage variants. */
  colour: "red" | "blue" | "green";
  /** One short line under the name on the Tome. */
  blurb: string;
  /** false = shown in the carousel as "Coming soon" and cannot be chosen. */
  available: boolean;
};

export const VOICES: readonly VoiceOption[] = [
  { id: "wizard", label: "Wizard", colour: "red", blurb: "The Sage as an old court mage", available: true },
  { id: "plain", label: "Arbiter", colour: "blue", blurb: "Short, sure rulings from the bench", available: true },
  { id: "bard", label: "Bard", colour: "green", blurb: "Rulings with a rhyme and a wink", available: true },
];

export const DEFAULT_VOICE: VoiceId = "wizard";
const KEY = "arkane-aid.voice";

function isChoosable(value: string | null): value is VoiceId {
  return VOICES.some((voice) => voice.id === value && voice.available);
}

type VoiceContextType = {
  voice: VoiceId;
  setVoice: (voice: VoiceId) => void;
  /** true once the saved choice has been read from the device. */
  ready: boolean;
};

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voice, setVoiceState] = useState<VoiceId>(DEFAULT_VOICE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    Storage.getItem(KEY)
      .then((saved) => {
        if (live && isChoosable(saved)) setVoiceState(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const setVoice = useCallback((next: VoiceId) => {
    if (!isChoosable(next)) return;
    setVoiceState(next);
    Storage.setItem(KEY, next).catch(() => undefined);
  }, []);

  return <VoiceContext.Provider value={{ voice, setVoice, ready }}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) throw new Error("useVoice must be used within a VoiceProvider");
  return context;
}
