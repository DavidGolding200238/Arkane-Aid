import { useEffect, useRef } from "react";

type AccelerometerModule = typeof import("expo-sensors").Accelerometer;

let accelerometer: AccelerometerModule | null | undefined;

/** expo-sensors, loaded lazily so an older build without the native module just has no shaking. */
function load(): AccelerometerModule | null {
  if (accelerometer === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, so a missing native module never crashes
      accelerometer = (require("expo-sensors") as typeof import("expo-sensors")).Accelerometer;
    } catch {
      accelerometer = null;
    }
  }
  return accelerometer;
}

// 25 samples a second. On Android 12+ that needs HIGH_SAMPLING_RATE_SENSORS in the manifest
// (app.json android.permissions; a normal, install-time permission), or expo-sensors registers
// at SENSOR_DELAY_NORMAL, about 5 a second.
const SAMPLE_MS = 40;
/** Change in acceleration (in g) between two samples that counts as a jolt. */
const JOLT_G = 0.9;
/** Jolts closer together than this are one jolt. */
const JOLT_GAP_MS = 110;
/** Two jolts within this window means the phone is being shaken (not just bumped). */
const SHAKE_WINDOW_MS = 700;
/** No jolt for this long ends the shake. */
const QUIET_MS = 450;

type Handlers = {
  /** Each jolt while the phone is being shaken. */
  onJolt: () => void;
  /** The shaking stopped. */
  onShakeEnd: () => void;
};

/** Watch the accelerometer while `active`, and report shakes. Handlers can change every render. */
export function useShake(active: boolean, handlers: Handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!active) return;
    const sensor = load();
    if (!sensor) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let last: { x: number; y: number; z: number } | null = null;
    let lastJolt = 0;
    let firstJolt = 0;
    let jolts = 0;
    let shaking = false;
    let quiet: ReturnType<typeof setTimeout> | null = null;

    const end = () => {
      quiet = null;
      const wasShaking = shaking;
      shaking = false;
      jolts = 0;
      if (wasShaking && !cancelled) latest.current.onShakeEnd();
    };

    sensor
      .isAvailableAsync()
      .then((available) => {
        if (!available || cancelled) return;
        sensor.setUpdateInterval(SAMPLE_MS);
        subscription = sensor.addListener(({ x, y, z }) => {
          const prev = last;
          last = { x, y, z };
          if (!prev) return;
          const delta = Math.hypot(x - prev.x, y - prev.y, z - prev.z);
          const now = Date.now();
          if (delta < JOLT_G || now - lastJolt < JOLT_GAP_MS) return;
          lastJolt = now;
          if (!shaking) {
            if (now - firstJolt > SHAKE_WINDOW_MS) {
              firstJolt = now;
              jolts = 0;
            }
            jolts += 1;
            if (jolts >= 2) shaking = true;
          }
          if (shaking) {
            latest.current.onJolt();
            if (quiet) clearTimeout(quiet);
            quiet = setTimeout(end, QUIET_MS);
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (quiet) clearTimeout(quiet);
      subscription?.remove();
    };
  }, [active]);
}
