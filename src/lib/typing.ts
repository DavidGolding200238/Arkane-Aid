// The Sage's reply types itself out letter by letter at a steady speed, the same for every
// persona and whether or not it is read aloud. Time based, so a slow frame never slows the
// writing down: it just reveals a few more letters on the next one.

/** Letters per second. About 55 reads as smooth, quick handwriting. */
export const TYPING_CPS = 55;

/** How many characters are showing `elapsedMs` after typing started. Never splits a surrogate pair. */
export function revealCount(elapsedMs: number, length: number, text = "", cps = TYPING_CPS): number {
  if (length <= 0) return 0;
  if (!(elapsedMs > 0)) return 0;
  let n = Math.min(length, Math.floor((elapsedMs * cps) / 1000));
  // Keep an emoji or other astral character whole.
  if (n > 0 && n < length && text) {
    const code = text.charCodeAt(n - 1);
    if (code >= 0xd800 && code <= 0xdbff) n += 1;
  }
  return n;
}

/** How long the whole reply takes to type, in ms. */
export function typingDuration(length: number, cps = TYPING_CPS): number {
  return Math.ceil((Math.max(0, length) * 1000) / cps);
}
