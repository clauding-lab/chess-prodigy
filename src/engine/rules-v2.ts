import { colOf, insufficientMaterial, rowOf } from "./board";
import type { Position } from "./types";
import { isExperimentalOpponent, type OpponentConfig } from "./opponents";

export function isComputerDeadPosition(
  board: Position["board"],
  opponent: OpponentConfig,
): boolean {
  return isExperimentalOpponent(opponent) ? isDeadPositionV2(board) : insufficientMaterial(board);
}

/** Conservative dead-position recognition. Legacy rated engines retain board.ts exactly. */
export function isDeadPositionV2(board: Position["board"]): boolean {
  if (insufficientMaterial(board)) return true;
  let bishopColor: number | undefined;
  for (let square = 0; square < board.length; square++) {
    const piece = board[square];
    if (!piece || piece[1] === "k") continue;
    if (piece[1] !== "b") return false;
    const color = (rowOf(square) + colOf(square)) % 2;
    if (bishopColor !== undefined && color !== bishopColor) return false;
    bishopColor = color;
  }
  return true;
}
