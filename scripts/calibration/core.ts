import { BOOK_LINES } from "../../src/book/lines";
import { inCheck, insufficientMaterial, legalMoves, posKey } from "../../src/engine/board";
import type { Position } from "../../src/engine/types";
export type Score = 0 | 0.5 | 1;
export type ResultReason =
  "checkmate" | "stalemate" | "fifty-move-rule" | "threefold-repetition" | "insufficient-material";
export function terminalResult(
  position: Position,
  keys: Map<string, number>,
): { score: Score; reason: ResultReason } | null {
  if (!legalMoves(position).length)
    return inCheck(position, position.turn)
      ? { score: position.turn === "w" ? 0 : 1, reason: "checkmate" }
      : { score: 0.5, reason: "stalemate" };
  if (position.halfmove >= 100) return { score: 0.5, reason: "fifty-move-rule" };
  if ((keys.get(posKey(position)) ?? 0) >= 3) return { score: 0.5, reason: "threefold-repetition" };
  if (insufficientMaterial(position.board)) return { score: 0.5, reason: "insufficient-material" };
  return null;
}
export function terminalScore(position: Position, keys: Map<string, number>): Score | null {
  return terminalResult(position, keys)?.score ?? null;
}
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function wilson(p: number, n: number) {
  const z = 2.4,
    z2 = z * z,
    denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)] as const;
}
export function estimate(
  pairs: readonly (readonly [Score | null, Score | null])[],
  anchor: number,
) {
  const n = pairs.length;
  if (!n)
    return { rating: null, lower: null, upper: null, games: 0, eligible: false, unresolved: 0 };
  const values = pairs.flat(),
    unresolved = values.filter((v) => v === null).length;
  const sum = values.reduce<number>((s, v) => s + (v ?? 0), 0),
    p = sum / (2 * n);
  const low = wilson(p, n)[0],
    high = wilson((sum + unresolved) / (2 * n), n)[1];
  const elo = (score: number) => anchor + 400 * Math.log10(score / (1 - score));
  const raw = unresolved ? null : elo(p),
    lower = elo(low),
    upper = elo(high);
  const rating = raw !== null && Number.isFinite(raw) ? raw : null;
  return {
    rating,
    lower: Number.isFinite(lower) ? lower : null,
    upper: Number.isFinite(upper) ? upper : null,
    games: 2 * n,
    unresolved,
    eligible:
      [50, 100, 200].includes(n) &&
      !unresolved &&
      rating !== null &&
      rating >= 0 &&
      rating <= 10000 &&
      Number.isFinite(lower) &&
      Number.isFinite(upper) &&
      upper - lower <= 300,
  };
}

export function sampleOpening(seed: number): string[] {
  const candidates = BOOK_LINES.map((line) => line[0].split(" ")).filter(
    (moves) => moves.length >= 6,
  );
  return candidates[Math.floor(seededRandom(seed)() * candidates.length)].slice(0, 6);
}
