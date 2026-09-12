import bookData from "../book/morphy-book.json";
import model from "./morphy-model.json";
import { inCheck, insufficientMaterial, legalMoves, posKey, sqName, toFEN } from "./board";
import { evaluate } from "./eval";
import { historicalFeatures } from "./historical-features";
import { LEVEL_CFG, MATE, search } from "./search";
import type { AiResult, Level, Position } from "./types";

const book: Readonly<Record<string, readonly (string | number)[][]>> = bookData;

/** Fitted preferences in centipawns, White's perspective; material is never discounted. */
export function historicalStyle(position: Position): number {
  const dot = historicalFeatures(position).reduce(
    (sum, feature, i) => sum + feature * model.weights[i],
    0,
  );
  return 100 * Math.max(-2.5, Math.min(2.5, dot));
}

function historicalRandom(seed: number, position: Position, ply: number): number {
  let state = seed >>> 0;
  for (const character of `${toFEN(position)}:${ply}`)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let n = Math.imul(state ^ (state >>> 15), 1 | state);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

export function chooseHistoricalMove(
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now: () => number = () => performance.now(),
): AiResult {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid opponent seed.");
  if (!Number.isSafeInteger(ply) || ply < 0) throw new Error("Invalid opponent move identity.");
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
  const recorded = book[posKey(position)];
  if (recorded) {
    const byUci = new Map(
      legal.map((move) => [`${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`, move]),
    );
    const choices = recorded.flatMap(([uci, count]) => {
      const move = typeof uci === "string" ? byUci.get(uci) : undefined;
      return move && typeof count === "number" && Number.isSafeInteger(count) && count > 0
        ? [{ move, count }]
        : [];
    });
    if (choices.length) {
      let target =
        historicalRandom(seed, position, ply) *
        choices.reduce((sum, choice) => sum + choice.count, 0);
      for (const choice of choices) {
        target -= choice.count;
        if (target < 0) return { move: choice.move, score: null, book: true };
      }
      return { move: choices[choices.length - 1].move, score: null, book: true };
    }
  }
  const result = search(
    position,
    config.depth,
    Math.max(0, deadline - now()),
    now,
    (p) => evaluate(p) + historicalStyle(p),
  );
  return { move: result.move, score: result.score, book: false };
}
