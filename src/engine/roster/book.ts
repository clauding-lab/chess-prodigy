import { posKey, toFEN } from "../board";
import type { Position } from "../types";
/** Lossless board compression with the existing canonical turn/castling/legal-en-passant suffix.
 * FEN board text is reversible and the separator makes the suffix unambiguous. No hash collisions.
 */
export function rosterBookKey(position: Position): string {
  const boardLength = position.board.reduce((n, piece) => n + (piece ? 2 : 1), 0);
  return `${toFEN(position).split(" ")[0]}|${posKey(position).slice(boardLength)}`;
}
