import { freshSession, reduceSession } from "../game/state";
import type { Session } from "../game/types";
import { isRating, parseSavedState } from "./schema";

export const SAVE_KEY = "chess-prodigy-state-v1";
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
}

export function loadSavedState(
  storage: StorageLike | null,
  now: number,
  fallbackId: string,
): LoadResult {
  const fallback = freshSession(now, fallbackId);
  if (!storage) return { session: fallback, status: "unavailable", hasSavedGame: false };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { session: fallback, status: "unavailable", hasSavedGame: false };
  }
  if (raw !== null) {
    try {
      const session = parseSavedState(JSON.parse(raw));
      if (!session) return { session: fallback, status: "corrupt", hasSavedGame: false };
      const settled = reduceSession(session, { type: "tick", now });
      return {
        session: settled,
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
  return { session: fallback, status: "unsaved", hasSavedGame: false };
}

export function saveState(storage: StorageLike | null, session: Session): boolean {
  if (!storage) return false;
  const normalized = parseSavedState(session);
  if (!normalized) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}
