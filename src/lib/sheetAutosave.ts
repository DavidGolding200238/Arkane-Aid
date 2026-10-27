import { saveCharacter, SheetUpdateNeeded, type Character, type CharacterDraft } from "./character";
import { errorText } from "./parties";

// Autosave for the Character Sheet. Every edit calls edit(), which saves 800 ms after the last
// one. Saves run one at a time (a chain), so two quick saves never insert two sheets. A failed
// save keeps the edits and retries (4 s, 8 s ... 30 s). flush() saves at once: the screen calls
// it on back, on leaving (tab change), on a party switch and when the app goes to the
// background. Only edits save, so opening a blank sheet never writes the empty template.

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AutosaveEvents = {
  status: (partyId: string | null, status: SaveStatus) => void;
  saved: (partyId: string | null, row: Character) => void;
  error: (partyId: string | null, message: string) => void;
};

type Snapshot = { draft: CharacterDraft; partyId: string | null; count: number; force: boolean };

export const AUTOSAVE_MS = 800;
const RETRY_FIRST_MS = 4000;
const RETRY_MAX_MS = 30000;
const keyOf = (partyId: string | null) => partyId ?? "none";

export class SheetAutosave {
  /** The party the screen shows now. */
  partyId: string | null = null;
  events: AutosaveEvents | null = null;
  private draft: CharacterDraft | null = null;
  private rows = new Map<string, Character>();
  private edits = 0;
  private queued = 0;
  private newest = new Map<string, number>();
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryMs = 0;
  private lastError: unknown = null;
  private save: typeof saveCharacter;

  constructor(save: typeof saveCharacter = saveCharacter) {
    this.save = save;
  }

  listen(events: AutosaveEvents | null) {
    this.events = events;
  }

  /** The screen moved to another party: pending edits still save to the old one's sheet. */
  switchParty(partyId: string | null) {
    if (partyId === this.partyId) return;
    this.flush();
    this.partyId = partyId;
  }

  /** The newest draft, edits not yet saved included. */
  latest(fallback: CharacterDraft) {
    return this.draft ?? fallback;
  }

  /** Waits for every queued save. */
  settled() {
    return this.chain;
  }

  row(partyId: string | null) {
    return this.rows.get(keyOf(partyId)) ?? null;
  }

  /** A freshly loaded sheet: nothing to save until the next edit. */
  loaded(partyId: string | null, row: Character | null, draft: CharacterDraft) {
    if (row) this.rows.set(keyOf(partyId), row);
    else this.rows.delete(keyOf(partyId));
    this.draft = draft;
    this.queued = this.edits;
  }

  edit(draft: CharacterDraft) {
    this.draft = draft;
    this.edits += 1;
    this.events?.status(this.partyId, "saving");
    this.clearTimer();
    this.timer = setTimeout(() => this.flush(), AUTOSAVE_MS);
  }

  /** Saves now if anything changed since the last save was queued. */
  flush() {
    this.clearTimer();
    if (this.draft && this.edits !== this.queued) this.enqueue(this.draft, false);
    return this.chain;
  }

  /** The saved sheet for this party, saving it first if there is none yet (portrait, gear, traits). */
  async ensureRow(partyId: string | null) {
    const existing = this.row(partyId);
    if (existing) return existing;
    this.clearTimer();
    if (this.draft) this.enqueue(this.draft, true);
    await this.chain;
    const saved = this.row(partyId);
    if (!saved) throw this.lastError ?? new Error("Couldn't save the sheet.");
    return saved;
  }

  /** Before deleting the sheet: drop pending saves for it and wait for running ones. */
  async discard(partyId: string | null) {
    this.clearTimer();
    this.queued = this.edits;
    this.newest.set(keyOf(partyId), Number.MAX_SAFE_INTEGER);
    await this.chain;
    const row = this.row(partyId);
    return row;
  }

  /** After the sheet was deleted. */
  deleted(partyId: string | null, draft: CharacterDraft) {
    this.rows.delete(keyOf(partyId));
    this.newest.delete(keyOf(partyId));
    this.draft = draft;
    this.queued = this.edits;
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private enqueue(draft: CharacterDraft, force: boolean) {
    const snap: Snapshot = { draft, partyId: this.partyId, count: this.edits, force };
    this.queued = snap.count;
    this.newest.set(keyOf(snap.partyId), snap.count);
    this.chain = this.chain.then(() => this.run(snap));
  }

  private async run(snap: Snapshot, attempt = 0): Promise<void> {
    const key = keyOf(snap.partyId);
    // A newer copy of this sheet is queued (it carries this edit too), or it was deleted.
    if ((this.newest.get(key) ?? 0) > snap.count) return;
    const done = (saved: Character) => {
      this.rows.set(key, saved);
      this.lastError = null;
      this.retryMs = 0;
      this.events?.saved(snap.partyId, saved);
      this.events?.status(snap.partyId, this.edits === snap.count ? "saved" : "saving");
    };
    this.events?.status(snap.partyId, "saving");
    try {
      done(await this.save(snap.partyId, snap.draft, this.rows.get(key) ?? null));
      this.events?.error(snap.partyId, "");
    } catch (err) {
      if (err instanceof SheetUpdateNeeded) {
        // Saved, apart from the fields the database does not have yet. Not worth retrying.
        done(err.saved);
        this.events?.error(snap.partyId, err.message);
        return;
      }
      this.lastError = err;
      this.events?.status(snap.partyId, "error");
      this.events?.error(snap.partyId, errorText(err));
      if (snap.force) return;
      // Keep the edits and try again, waiting longer each time. With the screen closed
      // (no listener) it still tries a few more times.
      this.retryMs = Math.min(RETRY_MAX_MS, this.retryMs ? this.retryMs * 2 : RETRY_FIRST_MS);
      if (!this.events && attempt >= 4) return;
      setTimeout(() => {
        this.chain = this.chain.then(() => this.run(snap, attempt + 1));
      }, this.retryMs);
    }
  }
}
