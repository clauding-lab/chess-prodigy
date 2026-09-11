import { START, applyMove, legalMoves, sanFor } from "../engine/board";
import type { Move, Position } from "../engine/types";
import type { GameRecord } from "../account/types";
import type { Session } from "./types";

export const ARCHIVE_LIMIT = 200;
export const ARCHIVE_MOVE_LIMIT = 500;

export function archiveGame(snapshot: Session): GameRecord | null {
  const game = snapshot.game;
  if (!game.over) return null;
  return {
    recordVersion: 2,
    opponent: { ...game.opponent },
    unratedReason: game.unratedReason,
    assisted:
      game.hintUsed || game.takebackUsed === true
        ? true
        : game.takebackUsed === null
          ? null
          : false,
    id: game.id,
    result: game.over.result,
    reason: game.over.reason,
    level: game.setup.level,
    playerColor: game.setup.playerColor,
    time: game.setup.time,
    rated: game.ratingApplied?.gameId === game.id,
    moves: game.hist.map((entry) => entry.san),
    completedAt: new Date(game.clockAt).toISOString(),
  };
}

export function retainedArchive(records: GameRecord[]): GameRecord[] {
  return [...new Map(records.map((record) => [record.id, record])).values()]
    .sort(
      (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || b.id.localeCompare(a.id),
    )
    .slice(0, ARCHIVE_LIMIT);
}

export function updateArchive(records: GameRecord[], snapshot: Session): GameRecord[] {
  const next = records.filter((record) => record.id !== snapshot.game.id);
  const terminal = archiveGame(snapshot);
  if (terminal) next.push(terminal);
  return retainedArchive(next);
}

export function replayRecord(record: GameRecord): { positions: Position[]; moves: Move[] } | null {
  if (record.moves.length > ARCHIVE_MOVE_LIMIT) return null;
  const positions = [START()],
    moves: Move[] = [];
  for (const san of record.moves) {
    const position = positions[positions.length - 1];
    let chosen: Move | undefined, after: Position | undefined;
    for (const move of legalMoves(position)) {
      const next = applyMove(position, move);
      if (sanFor(position, move, next) === san) {
        chosen = move;
        after = next;
        break;
      }
    }
    if (!chosen || !after) return null;
    moves.push(chosen);
    positions.push(after);
  }
  return { positions, moves };
}

export function rivalryKey(record: Pick<GameRecord, "opponent" | "level">): string {
  const { id, version, engine, randomPolicy } = record.opponent;
  return JSON.stringify([id, version, engine, randomPolicy, record.level]);
}
export interface OutcomeCounts {
  wins: number;
  draws: number;
  losses: number;
}
export function rivalrySummary(
  records: GameRecord[],
  target: Pick<GameRecord, "opponent" | "level">,
) {
  const summary = {
    total: 0,
    unassisted: { wins: 0, draws: 0, losses: 0 },
    assisted: { wins: 0, draws: 0, losses: 0 },
    unknown: { wins: 0, draws: 0, losses: 0 },
  };
  for (const record of retainedArchive(records)) {
    if (rivalryKey(record) !== rivalryKey(target)) continue;
    summary.total++;
    const count =
      record.assisted === null
        ? summary.unknown
        : record.assisted
          ? summary.assisted
          : summary.unassisted;
    if (record.result === "½-½") count.draws++;
    else if ((record.result === "1-0" ? "w" : "b") === record.playerColor) count.wins++;
    else count.losses++;
  }
  return summary;
}
