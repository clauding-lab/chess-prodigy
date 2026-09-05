import { parseSavedState } from "../storage/schema";
import type { GameRecord, RecordsEnvelope } from "./types";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";

function parseGameRecord(value: unknown): GameRecord | null {
  if (!object(value)) return null;
  if (
    !text(value.id) ||
    !["1-0", "0-1", "½-½"].includes(String(value.result)) ||
    !text(value.reason) ||
    !["casual", "club", "strong"].includes(String(value.level)) ||
    !["w", "b"].includes(String(value.playerColor)) ||
    typeof value.rated !== "boolean" ||
    !Array.isArray(value.moves) ||
    !value.moves.every(text) ||
    !text(value.completedAt) ||
    Number.isNaN(Date.parse(value.completedAt))
  )
    return null;
  return value as unknown as GameRecord;
}

export function parseRecordsEnvelope(value: unknown): RecordsEnvelope | null {
  if (!object(value) || !Number.isSafeInteger(value.version) || Number(value.version) < 0)
    return null;
  const snapshot = value.snapshot === null ? null : parseSavedState(value.snapshot);
  if (value.snapshot !== null && !snapshot) return null;
  if (
    !Array.isArray(value.games) ||
    value.games.length > 200 ||
    !(
      value.updatedAt === null ||
      (text(value.updatedAt) && !Number.isNaN(Date.parse(value.updatedAt)))
    )
  )
    return null;
  const games = value.games.map(parseGameRecord);
  if (games.some((game) => !game)) return null;
  return {
    version: Number(value.version),
    snapshot,
    games: games as GameRecord[],
    updatedAt: value.updatedAt as string | null,
  };
}
