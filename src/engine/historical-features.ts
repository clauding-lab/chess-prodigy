import { DIAG, KN, inB, isAttacked, kingSq } from "./board";
import type { Color, Position } from "./types";

/** Fixed model order. Each feature is normalized per side, then White minus Black. */
export const HISTORICAL_FEATURE_NAMES = [
  "development",
  "bishop-mobility",
  "rook-files",
  "central-presence",
  "king-ring-pressure",
  "castling-placement",
  "connected-rooks",
  "checks",
  "premature-queen-exposure",
  "knight-activity",
] as const;

/** Board-local proxies, not move-history claims. No legal move generation at search leaves.
 * Mobility includes unobstructed empty/enemy destinations (pins are deliberately ignored).
 * Castling means a king on c/g of its home rank, not proof that it previously castled.
 * Exposure means an advanced queen while own minor pieces remain on their home rank.
 * Promotions saturate the same normalizers instead of amplifying the style score.
 */
export function historicalFeatures(position: Position): number[] {
  const board = position.board;
  const values: Record<Color, number[]> = {
    w: Array<number>(10).fill(0),
    b: Array<number>(10).fill(0),
  };
  const homeMinors = { w: 0, b: 0 },
    advancedQueens = { w: 0, b: 0 };
  const rooks: Record<Color, number[]> = { w: [], b: [] };
  const pawns: Record<Color, boolean[]> = {
    w: Array<boolean>(8).fill(false),
    b: Array<boolean>(8).fill(false),
  };
  for (let square = 0; square < 64; square++) {
    const piece = board[square];
    if (piece?.[1] === "p") pawns[piece[0] as Color][square & 7] = true;
  }
  for (let square = 0; square < 64; square++) {
    const piece = board[square];
    if (!piece) continue;
    const side = piece[0] as Color,
      enemy = side === "w" ? "b" : "w",
      kind = piece[1],
      row = square >> 3,
      col = square & 7,
      home = side === "w" ? 7 : 0,
      v = values[side];
    if (kind === "n" || kind === "b") {
      if (row !== home) v[0]++;
      else homeMinors[side]++;
    }
    if (kind === "b") {
      for (const [dr, dc] of DIAG) {
        let r = row + dr,
          c = col + dc;
        while (inB(r, c)) {
          const target = board[r * 8 + c];
          if (target?.[0] === side) break;
          v[1]++;
          if (target) break;
          r += dr;
          c += dc;
        }
      }
    }
    if (kind === "r") {
      rooks[side].push(square);
      if (!pawns[side][col]) v[2] += pawns[enemy][col] ? 1 : 2;
    }
    if ((row === 3 || row === 4) && (col === 3 || col === 4)) v[3]++;
    if (kind === "k" && row === home && (col === 2 || col === 6)) v[5] = 1;
    if (kind === "q" && row !== home) advancedQueens[side]++;
    if (kind === "n")
      for (const [dr, dc] of KN) {
        const r = row + dr,
          c = col + dc;
        if (inB(r, c) && board[r * 8 + c]?.[0] !== side) v[9]++;
      }
  }
  for (const side of ["w", "b"] as const) {
    const enemy = side === "w" ? "b" : "w",
      king = kingSq(board, enemy),
      v = values[side];
    if (king >= 0) {
      const row = king >> 3,
        col = king & 7;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if ((dr || dc) && inB(row + dr, col + dc) && isAttacked(board, row + dr, col + dc, side))
            v[4]++;
      v[7] = Number(isAttacked(board, row, col, side));
    }
    for (let i = 0; i < rooks[side].length; i++)
      for (let j = i + 1; j < rooks[side].length; j++) {
        const a = rooks[side][i],
          b = rooks[side][j];
        if (a >> 3 !== b >> 3 && (a & 7) !== (b & 7)) continue;
        const step = a >> 3 === b >> 3 ? 1 : 8;
        let clear = true;
        for (let square = a + step; square < b; square += step)
          if (board[square]) {
            clear = false;
            break;
          }
        if (clear) v[6] = 1;
      }
    v[8] = advancedQueens[side] * homeMinors[side];
  }
  const scales = [4, 26, 4, 4, 8, 1, 1, 1, 4, 16];
  return scales.map(
    (scale, i) => Math.min(1, values.w[i] / scale) - Math.min(1, values.b[i] / scale),
  );
}
