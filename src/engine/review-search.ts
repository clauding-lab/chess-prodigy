// Neutral-only fork of the frozen legacy root search. Keep all root alternatives
// at one complete depth; old playing policies continue importing search.ts.
import { applyMove, inCheck, legalMoves, posKey, sameMove } from "./board";
import { evaluate, VAL } from "./eval";
import { isDeadPositionV2 } from "./rules-v2";
import type { Move, Position, SearchResult } from "./types";

const MATE = 100_000;
type Clock = () => number;
type SearchEvaluator = (position: Position) => number;
interface Entry {
  depth: number;
  score: number;
  best: Move | null;
  flag: 0 | 1 | 2;
}
interface Context {
  deadline: number;
  now: Clock;
  table: Map<string, Entry>;
  nodes: number;
  evaluate: SearchEvaluator;
}
const TIMEOUT = Symbol("search-timeout");

function orderMoves(moves: Move[], best?: Move | null): Move[] {
  return moves.sort((a, b) => scoreMove(b, best) - scoreMove(a, best));
}
function scoreMove(move: Move, best?: Move | null): number {
  let score = sameMove(move, best) ? 100_000 : 0;
  if (move.capture) score += 10 * VAL[move.capture[1]] + 50;
  if (move.promo) score += VAL[move.promo];
  return score;
}
function checkTime(context: Context): void {
  context.nodes++;
  if (context.now() >= context.deadline) throw TIMEOUT;
}

function quiesceInner(
  position: Position,
  alpha: number,
  beta: number,
  depth: number,
  ply: number,
  context: Context,
): number {
  checkTime(context);
  const checked = inCheck(position, position.turn),
    legal = legalMoves(position);
  if (!legal.length) return checked ? -MATE + ply : 0;
  if (position.halfmove >= 100 || isDeadPositionV2(position.board)) return 0;
  if (!checked) {
    const stand = context.evaluate(position) * (position.turn === "w" ? 1 : -1);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return alpha;
  }
  const moves = orderMoves(checked ? legal : legal.filter((move) => move.capture || move.promo));
  for (const move of moves) {
    const score = -quiesceInner(
      applyMove(position, move),
      -beta,
      -alpha,
      depth - 1,
      ply + 1,
      context,
    );
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  position: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  context: Context,
): number {
  checkTime(context);
  const useTable = depth >= 2,
    key = useTable ? posKey(position) : "",
    entry = useTable ? context.table.get(key) : undefined;
  if (entry && entry.depth >= depth) {
    if (entry.flag === 0) return entry.score;
    if (entry.flag === 1 && entry.score >= beta) return entry.score;
    if (entry.flag === 2 && entry.score <= alpha) return entry.score;
  }
  const moves = legalMoves(position);
  if (!moves.length) return inCheck(position, position.turn) ? -MATE + ply : 0;
  if (position.halfmove >= 100 || isDeadPositionV2(position.board)) return 0;
  if (depth <= 0) return quiesceInner(position, alpha, beta, 4, ply, context);
  orderMoves(moves, entry?.best);
  const originalAlpha = alpha;
  let best = -Infinity,
    bestMove: Move | null = null;
  for (const move of moves) {
    const score = -negamax(applyMove(position, move), depth - 1, -beta, -alpha, ply + 1, context);
    if (score > best) {
      best = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  if (useTable)
    context.table.set(key, {
      depth,
      score: best,
      best: bestMove,
      flag: best <= originalAlpha ? 2 : best >= beta ? 1 : 0,
    });
  return best;
}

/** Complete neutral alternatives. Scores are mover-relative; fallback is White-relative. */
export interface RootCandidates {
  candidates: { move: Move; score: number }[];
  depth: number;
  fallback: SearchResult;
  timedOut: boolean;
}

export function searchReviewCandidates(
  position: Position,
  maxDepth: number,
  ms: number,
  now: Clock = () => performance.now(),
  absoluteDeadline = Infinity,
): RootCandidates {
  const context: Context = {
    deadline: Math.min(absoluteDeadline, now() + Math.max(0, ms)),
    now,
    table: new Map(),
    nodes: 0,
    evaluate,
  };
  const moves = orderMoves(legalMoves(position)),
    sign = position.turn === "w" ? 1 : -1;
  const result: RootCandidates = {
    candidates: [],
    depth: 0,
    timedOut: false,
    fallback: { move: moves[0] ?? null, score: evaluate(position), depth: 0 },
  };
  if (!moves.length) {
    result.fallback.score = inCheck(position, position.turn) ? -MATE * sign : 0;
    return result;
  }
  if (position.halfmove >= 100 || isDeadPositionV2(position.board)) {
    result.fallback = { move: null, score: 0, depth: 0 };
    return result;
  }
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      const iteration: RootCandidates["candidates"] = [];
      for (const move of moves) {
        // No bound from another root can masquerade as this alternative's exact value.
        context.table.clear();
        const score = -negamax(
          applyMove(position, move),
          depth - 1,
          -Infinity,
          Infinity,
          1,
          context,
        );
        iteration.push({ move, score });
      }
      checkTime(context);
      const best = iteration.reduce((a, b) => (b.score > a.score ? b : a));
      result.candidates = iteration;
      result.depth = depth;
      result.fallback = { move: best.move, score: best.score * sign, depth };
      if (Math.abs(best.score) > MATE - 100) break;
    }
  } catch (error) {
    if (error !== TIMEOUT) throw error;
    result.timedOut = true;
  } finally {
    context.table.clear();
  }
  return result;
}
