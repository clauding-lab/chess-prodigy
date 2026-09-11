import { isUnratedReason, parseSavedState } from "../storage/schema";
import { CLASSIC, isOpponentConfig } from "../engine/opponents";
import type { GameRecord, RecordsEnvelope } from "./types";
import { ARCHIVE_MOVE_LIMIT } from "../game/archive";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";

export function parseGameRecord(value: unknown): GameRecord | null {
  if (!object(value)) return null;
  if (
    !text(value.id) ||
    !value.id.length ||
    value.id.length > 256 * 1024 ||
    !["1-0", "0-1", "½-½"].includes(String(value.result)) ||
    !text(value.reason) ||
    value.reason.length > 256 * 1024 ||
    !["casual", "club", "strong"].includes(String(value.level)) ||
    !["w", "b"].includes(String(value.playerColor)) ||
    typeof value.rated !== "boolean" ||
    !Array.isArray(value.moves) ||
    value.moves.length > ARCHIVE_MOVE_LIMIT ||
    !value.moves.every(
      (move) =>
        text(move) &&
        move.length <= 16 &&
        /^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?$/.test(move),
    ) ||
    (value.time !== undefined &&
      (!text(value.time) || !["none", "5+0", "10+0", "15+10"].includes(value.time))) ||
    !text(value.completedAt) ||
    Number.isNaN(Date.parse(value.completedAt))
  )
    return null;
  if (value.recordVersion === undefined) {
    if ("opponent" in value || "unratedReason" in value || "assisted" in value) return null;
    return {
      ...value,
      recordVersion: 2,
      opponent: { ...CLASSIC },
      unratedReason: value.rated ? null : "legacy-unrated",
      assisted: value.rated ? false : null,
    } as GameRecord;
  }
  if (
    value.recordVersion !== 2 ||
    !isOpponentConfig(value.opponent) ||
    !isUnratedReason(value.unratedReason) ||
    !(value.assisted === null || typeof value.assisted === "boolean") ||
    (value.rated &&
      (value.unratedReason !== null ||
        value.assisted === true ||
        value.opponent.id !== "classic")) ||
    (value.opponent.id === "attack-development" && value.unratedReason !== "beta")
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
