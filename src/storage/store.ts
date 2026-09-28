import { readStorageRevision, type WriteRevision } from "./revision";
import { freshSession, reduceSession, markEngineInterruption } from "../game/state";
import type { Session } from "../game/types";
import { parseSessionInput } from "./input";
import { encodeCompactSession } from "./compact";
import { isRating, parseSavedState } from "./schema";

export const SAVE_KEY = "chess-prodigy-state-v9";
export const REPAIR_SAVE_KEY = "chess-prodigy-state-v8";
export const ROSTER_SAVE_KEY = "chess-prodigy-state-v7";
export const CHIGORIN_SAVE_KEY = "chess-prodigy-state-v6";
export const PLANNED_SAVE_KEY = "chess-prodigy-state-v5";
export const HISTORICAL_SAVE_KEY = "chess-prodigy-state-v4";
export const MEASURED_SAVE_KEY = "chess-prodigy-state-v3";
export const BETA_SAVE_KEY = "chess-prodigy-state-v2";
export const PREVIOUS_SAVE_KEY = "chess-prodigy-state-v1";
export const LEGACY_KEY = "chess-fide-rating-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type LoadStatus = "saved" | "unsaved" | "corrupt" | "unavailable";
export interface LoadResult {
  session: Session;
  status: LoadStatus;
  hasSavedGame: boolean;
  storageRevision?: number;
}

export function loadSavedState(
  storage: StorageLike | null,
  now: number,
  fallbackId: string,
): LoadResult {
  const fallback = freshSession(now, fallbackId);
  if (!storage) return { session: fallback, status: "unavailable", hasSavedGame: false };
  let raw: string | null;
  let storageRevision = 0;
  try {
    raw = storage.getItem(SAVE_KEY);
    const revision = readStorageRevision(raw);
    if (revision === null) return { session: fallback, status: "corrupt", hasSavedGame: false };
    storageRevision = revision;
    if (raw === null) raw = storage.getItem(REPAIR_SAVE_KEY);
    if (raw === null) raw = storage.getItem(ROSTER_SAVE_KEY);
    if (raw === null) raw = storage.getItem(CHIGORIN_SAVE_KEY);
    if (raw === null) raw = storage.getItem(PLANNED_SAVE_KEY);
    if (raw === null) raw = storage.getItem(HISTORICAL_SAVE_KEY);
    if (raw === null) raw = storage.getItem(MEASURED_SAVE_KEY);
    if (raw === null) raw = storage.getItem(BETA_SAVE_KEY);
    if (raw === null) raw = storage.getItem(PREVIOUS_SAVE_KEY);
  } catch {
    return { session: fallback, status: "unavailable", hasSavedGame: false };
  }
  if (raw !== null) {
    try {
      const session = parseSessionInput(JSON.parse(raw));
      if (!session) return { session: fallback, status: "corrupt", hasSavedGame: false };
      const settled = reduceSession(
        { ...session, game: markEngineInterruption(session.game, "closed", now) },
        { type: "tick", now },
      );
      return {
        session: settled,
        storageRevision,
        status: "saved",
        hasSavedGame: settled.game.started && !settled.game.over,
      };
    } catch {
      return { session: fallback, status: "corrupt", hasSavedGame: false };
    }
  }
  try {
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const rating: unknown = JSON.parse(legacy);
      if (isRating(rating))
        return { session: { ...fallback, rating }, status: "unsaved", hasSavedGame: false };
    }
  } catch {
    // A bad legacy value is ignored because it is not the authoritative save.
  }
  return { session: fallback, status: "unsaved", hasSavedGame: false, storageRevision: 0 };
}

export function saveState(
  storage: StorageLike | null,
  session: Session,
  options: WriteRevision = {},
): boolean {
  if (!storage) return false;
  const normalized = parseSavedState(session);
  if (!normalized) return false;
  try {
    const prior = readStorageRevision(storage.getItem(SAVE_KEY));
    if (options.expectedRevision !== undefined && prior !== options.expectedRevision) return false;
    const revision = prior ?? 0;
    if (revision >= Number.MAX_SAFE_INTEGER) return false;
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...encodeCompactSession(normalized), storageRevision: revision + 1 }),
    );
    return true;
  } catch {
    return false;
  }
}
