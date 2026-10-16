import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Storage from "expo-sqlite/kv-store";

// The Sage's speaking voice, picked on the Tome screen. Sage does not read it
// yet; it will in a later step. Stored on the device (expo-sqlite key-value
// store, already used by the Supabase session), not in the database.

export type VoiceId = "wizard" | "plain" | "bard";

export type VoiceOption = {
  id: VoiceId;
  label: string;
  /** Orb colour in the Figma Sage variants. */
  colour: "red" | "blue" | "green";
  /** false = shown in the carousel as "Coming soon" and cannot be chosen. */
  available: boolean;
};

export const VOICES: readonly VoiceOption[] = [
  { id: "wizard", label: "Wizard", colour: "red", available: true },
  { id: "plain", label: "Plain", colour: "blue", available: true },
  { id: "bard", label: "Bard", colour: "green", available: false },
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
