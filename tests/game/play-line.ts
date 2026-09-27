import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { reduceSession } from "../../src/game/state";
import type { Session } from "../../src/game/types";

export function playLine(
  session: Session,
  line: string[],
  now = session.game.clockAt + 1,
): Session {
  for (const san of line) {
    const move = legalMoves(session.game.st).find(
      (move) => sanFor(session.game.st, move, applyMove(session.game.st, move)) === san,
    );
    if (!move) throw new Error(`Illegal fixture move: ${san}`);
    session = reduceSession(session, { type: "move", move, now, book: false });
  }
  return session;
}
export const FOOLS_MATE = ["f3", "e5", "g4", "Qh4#"];
