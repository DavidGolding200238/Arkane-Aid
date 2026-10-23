// What gets embedded for each SRD chunk (seed script, eval and tests share it). gte-small reads at
// most 512 tokens, so a long chunk is embedded as several pieces of at most PIECE_CHARS
// characters (about 350 tokens), each led by the entry's name and place in the SRD.
import { cleanTitle, type SrdChunk } from "./retrieval.ts";

export const PIECE_CHARS = 1400;

export function embedPieces(chunk: SrdChunk): string[] {
  const head = `${cleanTitle(chunk.t)} (${[...chunk.p].filter(Boolean).join(" > ") || chunk.k}): `;
  const text = chunk.x.replace(/\s+/g, " ").trim();
  const room = PIECE_CHARS - head.length;
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > room) {
    // Cut at the last sentence end, or else the last space, inside the window.
    const window = rest.slice(0, room);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "));
    if (cut < room * 0.5) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = room;
    pieces.push(head + rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest || !pieces.length) pieces.push(head + rest);
  return pieces;
}
