import type { WriteRevision } from "./revision";
import type { GameRecord } from "../account/types";
import type { Session } from "../game/types";
import { parseGameRecord, parseArchiveEviction } from "../account/records";
import { ARCHIVE_LIMIT } from "../game/archive";
import { updateRecoverableArchive, type ArchiveEviction } from "../game/archive-recovery";
import { parseSavedState } from "./schema";
import { saveState, type StorageLike } from "./store";

export const GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v8";
export const REPAIR_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v7";
export const ROSTER_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v6";
export const CHIGORIN_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v5";
export const PLANNED_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v4";
export const HISTORICAL_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v3";
export const MEASURED_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v2";
export const PREVIOUS_GUEST_HISTORY_KEY = "chess-prodigy-guest-history-v1";
export interface HistoryResult {
  games: GameRecord[];
  status: "ready" | "corrupt" | "unavailable" | "incomplete";
  pending?: boolean;
  raw?: string;
  evicted?: ArchiveEviction;
}
export function parseHistory(value: unknown): GameRecord[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const history = value as { version?: unknown; games?: unknown; evicted?: unknown };
  if (
    (history.version !== 1 && history.version !== 2) ||
    (history.evicted !== undefined &&
      (history.version !== 2 || !parseArchiveEviction(history.evicted))) ||
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
      storage.getItem(REPAIR_GUEST_HISTORY_KEY) ??
      storage.getItem(ROSTER_GUEST_HISTORY_KEY) ??
      storage.getItem(CHIGORIN_GUEST_HISTORY_KEY) ??
      storage.getItem(PLANNED_GUEST_HISTORY_KEY) ??
      storage.getItem(HISTORICAL_GUEST_HISTORY_KEY) ??
      storage.getItem(MEASURED_GUEST_HISTORY_KEY) ??
      storage.getItem(PREVIOUS_GUEST_HISTORY_KEY);
  } catch {
    return { games: [], status: "unavailable" };
  }
  if (raw === null) return { games: [], status: "ready" };
  try {
    const value: unknown = raw.length <= 2500000 ? JSON.parse(raw) : null;
    const games = parseHistory(value);
    if (games) {
      const evicted = (value as { evicted?: unknown }).evicted;
      return {
        games,
        status: "ready",
        ...(evicted ? { evicted: parseArchiveEviction(evicted)! } : {}),
      };
    }
  } catch {
    /* Preserve the original bytes below. */
  }
  return { games: [], status: "corrupt", raw };
}
export function saveGuestProgress(
  storage: StorageLike | null,
  session: Session,
  options: WriteRevision = {},
): boolean {
  const normalized = parseSavedState(session);
  if (!storage || !normalized) return false;
  // The active game is authoritative. Do not clear recovery for a replacement
  // until that replacement is durable. An interrupted archive write can be
  // reconciled idempotently from this saved active game on the next transition.
  if (!saveState(storage, normalized, options)) return false;
  const history = loadGuestHistory(storage);
  let archived = history.status === "ready";
  if (archived) {
    try {
      const next = updateRecoverableArchive(history, normalized);
      const encoded = JSON.stringify({ version: 2, ...next });
      if (encoded.length > 2500000 || !parseHistory({ version: 2, ...next })) archived = false;
      else if (
        storage.getItem(GUEST_HISTORY_KEY) === null ||
        JSON.stringify(next.games) !== JSON.stringify(history.games) ||
        JSON.stringify(next.evicted) !== JSON.stringify(history.evicted)
      )
        storage.setItem(GUEST_HISTORY_KEY, encoded);
    } catch {
      archived = false;
    }
  }
  return archived;
}
