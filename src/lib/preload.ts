import { Asset } from "expo-asset";
import * as Font from "expo-font";
import { appFonts } from "../theme/typography";

// What the splash really waits for. Each task is counted when it finishes (or fails: a failed
// preload just means that thing loads later, as before), so the loading bar shows real progress.

type SageModule = typeof import("../screens/SageScreen");
let sage: SageModule | null = null;
let sageLoading: Promise<SageModule> | null = null;

/** Loads the Sage screen's code (three.js, the 3D renderer, the screen itself) once. */
export function loadSageScreen() {
  if (!sageLoading) {
    sageLoading = import("../screens/SageScreen").then((m) => {
      sage = m;
      return m;
    });
    sageLoading.catch(() => {
      sageLoading = null;
    });
  }
  return sageLoading;
}

/** The Sage screen component if its code is already loaded, so it can open without a blank frame. */
export function loadedSageScreen() {
  return sage?.default ?? null;
}

// Every image the main screens draw, so none of them pop in on first open.
const IMAGES = [
  require("../../assets/images/backgrounds/parchment.png"),
  require("../../assets/images/buttons/btn-circle-red.png"),
  require("../../assets/images/buttons/btn-torn-parchment.png"),
  require("../../assets/images/decor/ink-underline.png"),
  require("../../assets/images/decor/ink-underline-end.png"),
  require("../../assets/images/icons/icon-quill.png"),
  require("../../assets/images/tabbar/tab-bar-texture.jpg"),
  require("../../assets/images/tabbar/tab-active.png"),
];
const DASHBOARD = [
  require("../../assets/images/dashboard/skull-dragon.png"),
  require("../../assets/images/dashboard/seal-parchment.png"),
  require("../../assets/images/dashboard/ring-outer.png"),
  require("../../assets/images/dashboard/ring-inner.png"),
  require("../../assets/images/dashboard/gem-red.png"),
  require("../../assets/images/dashboard/gem-green.png"),
  require("../../assets/images/dashboard/gem-blue.png"),
  require("../../assets/images/dashboard/die-d20.png"),
];
const PAGES = [
  require("../../assets/images/panels/panel-ledger-cream-frame.png"),
  require("../../assets/images/panels/panel-ledger-cream-fill.jpg"),
  require("../../assets/images/panels/panel-codex-cream-frame.png"),
  require("../../assets/images/panels/panel-codex-cream-fill.jpg"),
  require("../../assets/images/panels/card-codex-frame.png"),
  require("../../assets/images/panels/card-codex-fill.jpg"),
  require("../../assets/images/ledger/stat-header.png"),
  require("../../assets/images/ledger/stat-body.png"),
  require("../../assets/images/ledger/portrait-placeholder.jpg"),
  require("../../assets/images/ledger/portrait-ink.png"),
  require("../../assets/images/tome/d20-badge.png"),
  require("../../assets/images/tome/voice-orb-wizard.png"),
  require("../../assets/images/tome/voice-orb-plain.png"),
  require("../../assets/images/tome/voice-orb-bard.png"),
  require("../../assets/images/tome/arrow-left.png"),
  require("../../assets/images/tome/arrow-right.png"),
];
const SAGE_ART = [
  require("../../assets/images/sage/fire-red-1.png"),
  require("../../assets/images/sage/fire-blue-1.png"),
];

async function prefetchFire() {
  // Download both fire loops and put them in expo-image's cache, so the flames are there the
  // moment the Sage opens instead of decoding 2.4 MB each on first view.
  const [{ Image }, { LOOP_RED, LOOP_BLUE }] = await Promise.all([
    import("expo-image"),
    import("../components/flames/FireLoop"),
  ]);
  const assets = await Asset.loadAsync([LOOP_RED, LOOP_BLUE]);
  const uris = assets.map((a) => a.localUri ?? a.uri).filter(Boolean);
  if (uris.length) await Image.prefetch(uris, "memory-disk");
}

async function warmSage() {
  // The Sage screen's code first (its first open used to fetch and run three.js behind a blank
  // screen), then the orb model: read, decoded and parsed once, kept for every visit.
  await loadSageScreen();
  const { preloadSageOrb } = await import("../components/SageAvatar");
  await preloadSageOrb();
}

export type PreloadTask = { name: string; run: () => Promise<unknown> };

export const PRELOAD_TASKS: PreloadTask[] = [
  { name: "fonts", run: () => Font.loadAsync(appFonts) },
  { name: "common art", run: () => Asset.loadAsync(IMAGES) },
  { name: "dashboard art", run: () => Asset.loadAsync(DASHBOARD) },
  { name: "page art", run: () => Asset.loadAsync(PAGES) },
  { name: "sage art", run: () => Asset.loadAsync(SAGE_ART) },
  { name: "sage fire", run: prefetchFire },
  { name: "sage screen and orb", run: warmSage },
];

/**
 * Runs every preload task in parallel and reports progress (0..1) as each one finishes.
 * Resolves when all are done, or after `timeoutMs` at the latest so the app can never hang
 * on the splash; anything unfinished then simply carries on loading in the background.
 */
export function runPreload(onProgress: (progress: number) => void, timeoutMs = 15000) {
  const total = PRELOAD_TASKS.length;
  let done = 0;
  onProgress(0);
  const all = Promise.all(
    PRELOAD_TASKS.map((task) =>
      task
        .run()
        .catch((err: unknown) => {
          if (__DEV__) console.warn(`Preload of ${task.name} failed; it will load on first use.`, err);
        })
        .finally(() => {
          done += 1;
          onProgress(done / total);
        }),
    ),
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([all.then(() => undefined), timeout]);
}
