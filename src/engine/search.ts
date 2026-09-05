import {
  applyMove,
  inCheck,
  insufficientMaterial,
  legalMoves,
  posKey,
  sameMove,
  sanFor,
} from "./board";
import { evaluate, VAL } from "./eval";
import type { AiResult, Level, Move, Position, SearchResult } from "./types";

export const MATE = 100_000;
export const LEVEL_CFG: Readonly<
  Record<Level, { depth: number; ms: number; noise: number; book: number }>
> = {
  casual: { depth: 1, ms: 200, noise: 120, book: 0.5 },
  club: { depth: 2, ms: 600, noise: 15, book: 1 },
  strong: { depth: 4, ms: 2000, noise: 0, book: 1 },
};

type Clock = () => number;
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
  if (position.halfmove >= 100 || insufficientMaterial(position.board)) return 0;
  if (!checked) {
    const stand = evaluate(position) * (position.turn === "w" ? 1 : -1);
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

export function quiesce(
  position: Position,
  alpha: number,
  beta: number,
  depth: number,
  ply = 0,
  now: Clock = () => performance.now(),
): number {
  return quiesceInner(position, alpha, beta, depth, ply, {
    deadline: Infinity,
    now,
    table: new Map(),
    nodes: 0,
  });
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
  if (position.halfmove >= 100 || insufficientMaterial(position.board)) return 0;
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

export function search(
  position: Position,
  maxDepth: number,
  ms: number,
  now: Clock = () => performance.now(),
): SearchResult {
  const started = now(),
    context: Context = { deadline: started + Math.max(0, ms), now, table: new Map(), nodes: 0 };
  try {
    const moves = orderMoves(legalMoves(position));
    if (!moves.length)
      return {
        move: null,
        score: inCheck(position, position.turn) ? -MATE * (position.turn === "w" ? 1 : -1) : 0,
        depth: 0,
      };
    if (position.halfmove >= 100 || insufficientMaterial(position.board))
      return { move: null, score: 0, depth: 0 };
    let best = moves[0],
      bestScore = evaluate(position) * (position.turn === "w" ? 1 : -1),
      completed = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (depth > 1 && now() - started > ms * 0.45) break;
      let iterationBest: Move | null = null,
        iterationScore = -Infinity,
        alpha = -Infinity;
      try {
        for (const move of orderMoves(moves.slice(), best)) {
          const score = -negamax(
            applyMove(position, move),
            depth - 1,
            -Infinity,
            -alpha,
            1,
            context,
          );
          if (score > iterationScore) {
            iterationScore = score;
            iterationBest = move;
          }
          if (score > alpha) alpha = score;
        }
      } catch (error) {
        if (error !== TIMEOUT) throw error;
        break;
      }
      if (iterationBest) {
        best = iterationBest;
        bestScore = iterationScore;
        completed = depth;
      }
      if (Math.abs(bestScore) > MATE - 100) break;
    }
    return { move: best, score: bestScore * (position.turn === "w" ? 1 : -1), depth: completed };
  } finally {
    context.deadline = Infinity;
    context.table.clear();
  }
}

export const analyse = (position: Position, ms = 300, maxDepth = 3, now?: Clock): SearchResult =>
  search(position, maxDepth, ms, now);

export function chooseAiMove(
  position: Position,
  level: Level,
  bookSans: string[],
  now: Clock = () => performance.now(),
  random: () => number = Math.random,
): AiResult {
  const config = LEVEL_CFG[level],
    legal = legalMoves(position);
  if (bookSans.length && random() < config.book) {
    const san = bookSans[Math.floor(random() * bookSans.length)];
    const move = legal.find(
      (candidate) => sanFor(position, candidate, applyMove(position, candidate)) === san,
    );
    if (move) return { move, score: null, book: true };
  }
  if (level !== "casual") {
    const result = search(position, config.depth, config.ms, now);
    return { move: result.move, score: result.score, book: false };
  }
  const context: Context = { deadline: now() + config.ms, now, table: new Map(), nodes: 0 };
  let best = legal[0] ?? null,
    bestScore = -Infinity;
  try {
    for (const move of orderMoves(legal)) {
      const next = applyMove(position, move);
      let score =
        -quiesceInner(next, -Infinity, Infinity, 2, 1, context) + (random() * 2 - 1) * config.noise;
      if (!legalMoves(next).length && inCheck(next, next.turn)) score = MATE;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
  } catch (error) {
    if (error !== TIMEOUT) throw error;
  } finally {
    context.deadline = Infinity;
    context.table.clear();
  }
  return { move: best, score: null, book: false };
}
