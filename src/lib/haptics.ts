// Small, subtle buzzes through the phone's own haptics (expo-haptics). Loaded lazily and every
// call is fire-and-forget, so a phone or build without haptics simply stays silent.
type HapticsModule = typeof import("expo-haptics");

let haptics: HapticsModule | null | undefined;

function load(): HapticsModule | null {
  if (haptics === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, so a missing native module never crashes
      haptics = require("expo-haptics") as HapticsModule;
    } catch {
      haptics = null;
    }
  }
  return haptics;
}

function impact(style: "Light" | "Medium") {
  const mod = load();
  if (!mod) return;
  mod.impactAsync(mod.ImpactFeedbackStyle[style]).catch(() => {});
}

/** A light tick for ordinary button and tab presses. */
export function tapHaptic() {
  impact("Light");
}

/** A firmer buzz: the Sage orb starts listening. */
export function holdHaptic() {
  impact("Medium");
}
