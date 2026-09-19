// Node calibration only: browser entries import just their own policy/book.
import { chooseOpponentMove } from "../morphy";
import { isRosterOpponent, type OpponentConfig } from "../opponents";
import type { AiResult, Level, Position } from "../types";
import { chooseSpasskyMove } from "./spassky";
import { chooseTalMove } from "./tal";
import { chooseFischerMove } from "./fischer";
export function chooseRosterOpponentMove(
  position: Position,
  level: Level,
  bookSans: string[],
  opponent: OpponentConfig,
  ply: number,
  now?: () => number,
): AiResult {
  if (isRosterOpponent(opponent)) {
    const choose =
      opponent.id === "spassky"
        ? chooseSpasskyMove
        : opponent.id === "tal"
          ? chooseTalMove
          : chooseFischerMove;
    return choose(position, level, opponent.seed!, ply, now);
  }
  return chooseOpponentMove(position, level, bookSans, opponent, ply, now);
}
