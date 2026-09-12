import type { GameRecord } from "../account/types";
import type { Session } from "../game/types";
import { parseGameRecord } from "../account/records";
import { ARCHIVE_LIMIT, updateArchive } from "../game/archive";
import { parseSavedState } from "./schema";
import { saveState, type StorageLike } from "./store";

export const GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v4";
export const HISTORICAL_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v3";
export const MEASURED_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v2";
export const PREVIOUS_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v1";
export interface HistoryResult {
  games: GameRecord[];
  status: "ready" | "corrupt" | "unavailable" | "incomplete";
  pending?: boolean;
  raw?: string;
}
export function parseHistory(value: unknown): GameRecord[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const history = value as { version?: unknown; games?: unknown };
  if (
    history.version !== 1 ||
    !Array.isArray(history.games) ||
    history.games.length > ARCHIVE_LIMIT
  )
    return null;
  const games = history.games.map(parseGameRecord);
  if (games.some((game) => !game) || new Set(games.map((game) => game?.id)).size !== games.length)
    return null;
  return games as GameRecord[];
}
export function loadGuestHistory(storage: StorageLike | null): HistoryResult {
  let raw: string | null;
  try {
    if (!storage) return { games: [], status: "unavailable" };
    raw =
      storage.getItem(GUEST_HISTORY_KEY) ??
      storage.getItem(HISTORICAL_GUEST_HISTORY_KEY) ??
      storage.getItem(MEASURED_GUEST_HISTORY_KEY) ??
      storage.getItem(PREVIOUS_GUEST_HISTORY_KEY);
  } catch {
    return { games: [], status: "unavailable" };
  }
  if (raw === null) return { games: [], status: "ready" };
  try {
    const games = raw.length <= 2500000 ? parseHistory(JSON.parse(raw)) : null;
    if (games) return { games, status: "ready" };
  } catch {
    /* Preserve the original bytes below. */
  }
  return { games: [], status: "corrupt", raw };
}
export function saveGuestProgress(storage: StorageLike | null, session: Session): boolean {
  const normalized = parseSavedState(session);
  if (!storage || !normalized) return false;
  const history = loadGuestHistory(storage);
  let archived = history.status === "ready";
  if (archived) {
    try {
      const games = updateArchive(history.games, normalized);
      const encoded = JSON.stringify({ version: 1, games });
      if (encoded.length > 2500000 || !parseHistory({ version: 1, games })) archived = false;
      else if (
        storage.getItem(GUEST_HISTORY_KEY) === null ||
        JSON.stringify(games) !== JSON.stringify(history.games)
      )
        storage.setItem(GUEST_HISTORY_KEY, encoded);
    } catch {
      archived = false;
    }
  }
  // Active state remains the recovery authority if the independent archive write fails.
  // On reopening, reconcile its terminal/undone ID without touching unrelated records.
  const saved = saveState(storage, normalized);
  return archived && saved;
}
