// Buzzes for the dice roller, with the same lazy, fire-and-forget pattern as src/lib/haptics.ts:
// a phone or build without haptics simply stays silent.
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

function impact(style: "Light" | "Medium" | "Heavy") {
  const mod = load();
  if (!mod) return;
  mod.impactAsync(mod.ImpactFeedbackStyle[style]).catch(() => {});
}

function notify(type: "Success" | "Error") {
  const mod = load();
  if (!mod) return;
  mod.notificationAsync(mod.NotificationFeedbackType[type]).catch(() => {});
}

/** Each shake of the phone: the dice rattle in the tray. */
export function rattleHaptic() {
  impact("Light");
}

/** The dice hit the table. */
export function landHaptic() {
  impact("Medium");
}

/** A natural 20: a strong, celebratory buzz. */
export function nat20Haptic() {
  notify("Success");
  setTimeout(() => impact("Heavy"), 180);
}

/** A natural 1. */
export function nat1Haptic() {
  notify("Error");
}
