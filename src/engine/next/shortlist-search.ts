// Inactive E2 shortlist experiment; bounds are never exact candidate rankings.
import { applyMove, fromFEN, inCheck, legalMoves, posKey, sameMove, toFEN } from "../board";
import { evaluate, VAL } from "../eval";
import { isDeadPositionV2 } from "../rules-v2";
import type { Move, Position } from "../types";

export const NEXT_SHORTLIST_SEARCH_POLICY = "next-neutral-shortlist-v1";
const MATE = 100_000;
type Interruption = "deadline" | "nodes" | "cancelled" | "forcing-limit";
type Terminal =
  "checkmate" | "stalemate" | "fifty-move-rule" | "threefold-repetition" | "dead-position";
export interface NextSearchOptions {
  candidateWindowCp?: number;
  maxDepth: number;
  ms: number;
  absoluteDeadline?: number;
  now?: () => number;
  cancelled?: () => boolean;
  maxNodes?: number;
  /** Development/reference mode; never an implicit production fallback policy. */
  baselineOnly?: boolean;
  /** Explicit bounded policy setting; production candidates must freeze its value. */
  forcingSafetyPlies?: number;
}
export interface CandidateEvidence {
  move: Move;
  score: number;
  kind: "exact" | "upper-bound" | "lower-bound";
  depth: number;
}
interface Evidence {
  policy: typeof NEXT_SHORTLIST_SEARCH_POLICY;
  position: string;
  history: string;
  perspective: "white";
  nodes: number;
  elapsedMs: number;
  attemptedDepth: number;
  interruption: Interruption | null;
  terminal: Terminal | null;
  iterations: { phase: "baseline" | "forcing"; depth: number; nodes: number }[];
  settings: {
    candidateWindowCp: number;
    maxDepth: number;
    forcingCapturePlies: 4;
    forcingSafetyPlies: number;
    baselineOnly: boolean;
  };
}
export type NextSearchResult = Evidence &
  (
    | { kind: "terminal"; move: null; score: number; depth: 0; phase: null; candidates: [] }
    | { kind: "incomplete"; move: null; score: null; depth: 0; phase: null; candidates: [] }
    | {
        kind: "completed";
        move: Move;
        score: number;
        depth: number;
        phase: "baseline" | "forcing";
        candidates: CandidateEvidence[];
      }
  );
class Interrupted extends Error {
  constructor(readonly reason: Interruption) {
    super(reason);
  }
}
function historyFingerprint(history: readonly string[]): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of JSON.stringify(history)) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
function ordered(moves: Move[], preferred?: Move): Move[] {
  const value = (move: Move) =>
    (sameMove(move, preferred) ? 100000 : 0) +
    (move.capture ? 10 * VAL[move.capture[1]] : 0) +
    (move.promo ? VAL[move.promo] : 0);
  return [...moves].sort((a, b) => value(b) - value(a));
}

/** Prior FENs exclude the current root. Callers supply legally replayed history. */
export function searchNextShortlist(
  position: Position,
  history: readonly string[],
  options: NextSearchOptions,
): NextSearchResult {
  if (
    (options.candidateWindowCp !== undefined &&
      (!Number.isInteger(options.candidateWindowCp) ||
        options.candidateWindowCp < 0 ||
        options.candidateWindowCp > 300)) ||
    !Number.isInteger(options.maxDepth) ||
    options.maxDepth < 2 ||
    options.maxDepth > 8 ||
    !Number.isFinite(options.ms) ||
    options.ms < 0 ||
    (options.maxNodes !== undefined &&
      (!Number.isSafeInteger(options.maxNodes) || options.maxNodes < 0)) ||
    (options.absoluteDeadline !== undefined && !Number.isFinite(options.absoluteDeadline)) ||
    (options.forcingSafetyPlies !== undefined &&
      (!Number.isInteger(options.forcingSafetyPlies) ||
        options.forcingSafetyPlies < 0 ||
        options.forcingSafetyPlies > 12)) ||
    !Array.isArray(history) ||
    history.length > 12800
  )
    throw new Error("Invalid next-search limits or history.");
  const clock = options.now ?? (() => performance.now());
  const now = () => {
    const value = clock();
    if (!Number.isFinite(value)) throw new Error("Invalid search clock.");
    return value;
  };
  const candidateWindowCp = options.candidateWindowCp ?? 100;
  const safetyPlies = options.forcingSafetyPlies ?? 12;
  const started = now();
  const deadline = Math.min(started + options.ms, options.absoluteDeadline ?? Infinity);
  const counts = new Map<string, number>();
  for (const fen of history) {
    if (typeof fen !== "string" || fen.length > 128) throw new Error("Invalid prior position.");
    const key = posKey(fromFEN(fen));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rootKey = posKey(position);
  counts.set(rootKey, (counts.get(rootKey) ?? 0) + 1);
  let nodes = 0;
  let attemptedDepth = 0;
  let interruption: Interruption | null = null;
  const iterations: Evidence["iterations"] = [];
  const identity = {
    policy: NEXT_SHORTLIST_SEARCH_POLICY as typeof NEXT_SHORTLIST_SEARCH_POLICY,
    position: toFEN(position),
    history: historyFingerprint(history),
    perspective: "white" as const,
  };
  const checkpoint = () => {
    if (options.cancelled?.()) throw new Interrupted("cancelled");
    if (now() >= deadline) throw new Interrupted("deadline");
  };
  const enter = () => {
    checkpoint();
    if (nodes >= (options.maxNodes ?? Infinity)) throw new Interrupted("nodes");
    nodes++;
  };
  const terminal = (
    p: Position,
    moves: Move[],
    ply: number,
  ): { score: number; reason: Terminal } | null => {
    if (!moves.length)
      return inCheck(p, p.turn)
        ? { score: -MATE + ply, reason: "checkmate" }
        : { score: 0, reason: "stalemate" };
    if (p.halfmove >= 100) return { score: 0, reason: "fifty-move-rule" };
    if ((counts.get(posKey(p)) ?? 0) >= 3) return { score: 0, reason: "threefold-repetition" };
    if (isDeadPositionV2(p.board)) return { score: 0, reason: "dead-position" };
    return null;
  };
  const child = (p: Position, move: Move, visit: (next: Position) => number): number => {
    checkpoint();
    const next = applyMove(p, move),
      key = posKey(next),
      previous = counts.get(key) ?? 0;
    counts.set(key, previous + 1);
    try {
      return visit(next);
    } finally {
      if (previous) counts.set(key, previous);
      else counts.delete(key);
    }
  };
  const leaf = (p: Position) => {
    checkpoint();
    const score = evaluate(p) * (p.turn === "w" ? 1 : -1);
    checkpoint();
    if (!Number.isFinite(score)) throw new Error("Non-finite evaluation.");
    return score;
  };
  function baseline(p: Position, remaining: number, ply: number): number {
    enter();
    const moves = legalMoves(p),
      ending = terminal(p, moves, ply);
    checkpoint();
    if (ending) return ending.score;
    if (!remaining) return leaf(p);
    let best = -Infinity;
    for (const move of ordered(moves))
      best = Math.max(best, -child(p, move, (next) => baseline(next, remaining - 1, ply + 1)));
    return best;
  }
  // Fail-soft alpha/beta bounds stay internal. Full-window roots alone are published as exact.
  function forcing(
    p: Position,
    alpha: number,
    beta: number,
    remaining: number,
    ply: number,
    safety: number,
  ): number {
    enter();
    const moves = legalMoves(p),
      ending = terminal(p, moves, ply);
    checkpoint();
    if (ending) return ending.score;
    const checked = inCheck(p, p.turn);
    if (checked && safety <= 0) throw new Interrupted("forcing-limit");
    let best = checked ? -Infinity : leaf(p);
    if (!checked) {
      if (best >= beta || remaining <= 0 || safety <= 0) return best;
      alpha = Math.max(alpha, best);
    }
    for (const move of ordered(
      checked ? moves : moves.filter((move) => move.capture || move.promo),
    )) {
      const score = -child(p, move, (next) =>
        forcing(next, -beta, -alpha, remaining - 1, ply + 1, safety - 1),
      );
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }
  function negamax(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    if (depth <= 0) return forcing(p, alpha, beta, 4, ply, safetyPlies);
    enter();
    const moves = legalMoves(p),
      ending = terminal(p, moves, ply);
    checkpoint();
    if (ending) return ending.score;
    let best = -Infinity;
    for (const move of ordered(moves)) {
      const score = -child(p, move, (next) => negamax(next, depth - 1, -beta, -alpha, ply + 1));
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }
  const moves = legalMoves(position),
    ending = terminal(position, moves, 0);
  const evidence = (): Evidence => ({
    ...identity,
    nodes,
    elapsedMs: Math.max(0, now() - started),
    attemptedDepth,
    interruption,
    terminal: ending?.reason ?? null,
    iterations,
    settings: {
      candidateWindowCp,
      maxDepth: options.maxDepth,
      forcingCapturePlies: 4,
      forcingSafetyPlies: safetyPlies,
      baselineOnly: options.baselineOnly === true,
    },
  });
  const sign = position.turn === "w" ? 1 : -1;
  if (ending)
    return {
      ...evidence(),
      kind: "terminal",
      move: null,
      score: ending.score === 0 ? 0 : ending.score * sign,
      depth: 0,
      phase: null,
      candidates: [],
    };
  let snapshot: {
    move: Move;
    score: number;
    depth: number;
    phase: "baseline" | "forcing";
    candidates: CandidateEvidence[];
  } | null = null;
  const iteration = (depth: number, phase: "baseline" | "forcing") => {
    attemptedDepth = depth;
    const candidates: CandidateEvidence[] = [];
    let bestRelative = -Infinity;
    for (const move of ordered(moves, snapshot?.move)) {
      checkpoint();
      if (phase === "forcing" && Number.isFinite(bestRelative)) {
        const threshold = bestRelative - candidateWindowCp;
        const bound = -child(position, move, (next) =>
          negamax(next, depth - 1, -Infinity, -threshold, 1),
        );
        if (bound < threshold) {
          candidates.push({
            move,
            score: bound === 0 ? 0 : bound * sign,
            kind: sign === 1 ? "upper-bound" : "lower-bound",
            depth,
          });
          continue;
        }
      }
      const score = -child(position, move, (next) =>
        phase === "baseline"
          ? baseline(next, 1, 1)
          : negamax(next, depth - 1, -Infinity, Infinity, 1),
      );
      bestRelative = Math.max(bestRelative, score);
      candidates.push({ move, score: score === 0 ? 0 : score * sign, kind: "exact", depth });
    }
    checkpoint();
    const best = candidates
      .filter((candidate) => candidate.kind === "exact")
      .reduce((a, b) => (b.score * sign > a.score * sign ? b : a));
    snapshot = { move: best.move, score: best.score, depth, phase, candidates };
    iterations.push({ phase, depth, nodes });
  };
  try {
    iteration(2, "baseline");
    if (!options.baselineOnly)
      for (let depth = 2; depth <= options.maxDepth; depth++) iteration(depth, "forcing");
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    interruption = error.reason;
  }
  // TypeScript cannot follow the synchronous closure's assignment across iteration().
  const completed = snapshot as {
    move: Move;
    score: number;
    depth: number;
    phase: "baseline" | "forcing";
    candidates: CandidateEvidence[];
  } | null;
  return completed
    ? { ...evidence(), kind: "completed", ...completed }
    : {
        ...evidence(),
        kind: "incomplete",
        move: null,
        score: null,
        depth: 0,
        phase: null,
        candidates: [],
      };
}
