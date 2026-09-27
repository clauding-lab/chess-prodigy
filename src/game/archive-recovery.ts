import type { GameRecord } from "../account/types";
import type { Session } from "./types";
import { archiveGame, retainedArchive } from "./archive";
import { canUndoGame } from "./state";

export interface ArchiveEviction {
  byGameId: string;
  record: GameRecord;
}
export interface RecoverableArchive {
  games: GameRecord[];
  evicted?: ArchiveEviction;
}

/** One reversible result may displace one retained game until the player moves on. */
export function updateRecoverableArchive(
  previous: RecoverableArchive,
  snapshot: Session,
): RecoverableArchive {
  const terminal = archiveGame(snapshot);
  const id = snapshot.game.id;
  const recovery = previous.evicted?.byGameId === id ? previous.evicted : undefined;
  const next = new Map(previous.games.map((record) => [record.id, record]));
  if (terminal) next.set(id, terminal);
  else {
    next.delete(id);
    if (recovery && snapshot.game.takebackUsed === true)
      next.set(recovery.record.id, recovery.record);
  }
  const games = retainedArchive([...next.values()]);
  if (!terminal || !canUndoGame(snapshot.game)) return { games };
  if (recovery) return { games, evicted: recovery };
  const retained = new Set(games.map((record) => record.id));
  const displaced = previous.games.find((record) => record.id !== id && !retained.has(record.id));
  return displaced ? { games, evicted: { byGameId: id, record: displaced } } : { games };
}
