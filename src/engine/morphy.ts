import {
  applyMove,
  inCheck,
  insufficientMaterial,
  isAttacked,
  kingSq,
  legalMoves,
  sanFor,
  toFEN,
} from "./board";
import { evaluate, nonPawnMaterial } from "./eval";
import { chooseAiMove, LEVEL_CFG, MATE, search } from "./search";
import { isOpponentConfig, isSupportedOpponent, type OpponentConfig } from "./opponents";
import { chooseHistoricalMove } from "./historical-morphy";
import type { AiResult, Color, Level, Move, Position } from "./types";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

/** style-v1: centipawns, White's perspective, capped at 0.8 pawn net influence.
 * Development/check/king pressure fade as non-pawn material falls from 6400 to 2600.
 * Useful rook files/bishop diagonals remain relevant in endings. No material discount.
 */
export function morphyStyle(position: Position): number {
  const board = position.board,
    material = nonPawnMaterial(board);
  const phase = clamp((material.w + material.b - 2600) / 3800, 0, 1);
  const value: Record<Color, number> = { w: 0, b: 0 };
  for (let square = 0; square < 64; square++) {
    const piece = board[square];
    if (!piece) continue;
    const side = piece[0] as Color,
      kind = piece[1],
      row = square >> 3,
      col = square & 7;
    if ((kind === "n" || kind === "b") && row !== (side === "w" ? 7 : 0)) value[side] += 8 * phase;
    if (kind === "b") {
      let reach = 0;
      for (const [dr, dc] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        let r = row + dr,
          c = col + dc;
        while (inside(r, c) && !board[r * 8 + c]) {
          reach++;
          r += dr;
          c += dc;
        }
      }
      value[side] += Math.min(8, Math.max(0, reach - 3)) * 1.5;
    }
    if (kind === "r") {
      let ownPawn = false,
        enemyPawn = false;
      for (let r = 0; r < 8; r++) {
        if (board[r * 8 + col] === `${side}p`) ownPawn = true;
        else if (board[r * 8 + col]?.[1] === "p") enemyPawn = true;
      }
      const dr = side === "w" ? -1 : 1;
      let r = row + dr,
        reach = 0;
      while (inside(r, col) && !board[r * 8 + col]) {
        reach++;
        r += dr;
      }
      if (!ownPawn && reach >= 3) value[side] += enemyPawn ? 6 : 12;
    }
  }
  if (phase > 0)
    for (const side of ["w", "b"] as const) {
      const enemy = side === "w" ? "b" : "w",
        king = kingSq(board, enemy);
      if (king < 0) continue;
      let pressure = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = (king >> 3) + dr,
            c = (king & 7) + dc;
          if ((dr || dc) && inside(r, c) && isAttacked(board, r, c, side)) pressure++;
        }
      value[side] += (Math.min(pressure, 5) * 4 + (inCheck(position, enemy) ? 12 : 0)) * phase;
    }
  return clamp(value.w - value.b, -80, 80);
}

export const evaluateMorphy = (position: Position): number =>
  evaluate(position) + morphyStyle(position);

export interface BookChoice {
  move: Move;
  san: string;
  weight: number;
}
export function weightedBookMoves(position: Position, replies: readonly string[]): BookChoice[] {
  const allowed = new Set(replies),
    sign = position.turn === "w" ? 1 : -1;
  return legalMoves(position).flatMap((move) => {
    const next = applyMove(position, move),
      san = sanFor(position, move, next);
    return allowed.has(san)
      ? [{ move, san, weight: Math.max(1, 32 + sign * morphyStyle(next)) }]
      : [];
  });
}

function perPlyRandom(seed: number, position: Position, ply: number): () => number {
  let state = seed >>> 0;
  for (const character of `${toFEN(position)}:${ply}`)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function chooseOpponentMove(
  position: Position,
  level: Level,
  bookSans: string[],
  opponent: OpponentConfig,
  ply: number,
  now: () => number = () => performance.now(),
): AiResult {
  if (!isOpponentConfig(opponent) || !isSupportedOpponent(opponent))
    throw new Error("Opponent configuration is unavailable. Saved progress is preserved.");
  if (opponent.id === "classic") return chooseAiMove(position, level, bookSans, now);
  if (!Number.isSafeInteger(ply) || ply < 0) throw new Error("Invalid opponent move identity.");
  if (opponent.version === 3)
    return chooseHistoricalMove(position, level, opponent.seed!, ply, now);
  const config = LEVEL_CFG[level],
    deadline = now() + config.ms,
    legal = legalMoves(position);
  if (!legal.length)
    return {
      move: null,
      score: inCheck(position, position.turn) ? -MATE * (position.turn === "w" ? 1 : -1) : 0,
      book: false,
    };
  if (position.halfmove >= 100 || insufficientMaterial(position.board))
    return { move: null, score: 0, book: false };
  // Immediate mates outrank even retained book choices; this work uses the same deadline.
  for (const move of legal) {
    if (now() >= deadline) break;
    const next = applyMove(position, move);
    if (inCheck(next, next.turn) && legalMoves(next).length === 0)
      return { move, score: (MATE - 1) * (position.turn === "w" ? 1 : -1), book: false };
  }
  if (legal.length === 1) return { move: legal[0], score: null, book: false };
  const random = perPlyRandom(opponent.seed!, position, ply);
  if (bookSans.length && random() < config.book && now() < deadline) {
    const choices = weightedBookMoves(position, bookSans);
    if (choices.length && now() < deadline) {
      let target = random() * choices.reduce((total, choice) => total + choice.weight, 0);
      for (const choice of choices) {
        target -= choice.weight;
        if (target <= 0) return { move: choice.move, score: null, book: true };
      }
    }
  }
  const result = search(position, config.depth, Math.max(0, deadline - now()), now, evaluateMorphy);
  return { move: result.move, score: result.score, book: false };
}
