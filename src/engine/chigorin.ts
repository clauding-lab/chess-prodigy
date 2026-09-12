import bookData from "../book/chigorin-book.json";
import {
  applyMove,
  inCheck,
  insufficientMaterial,
  kingSq,
  legalMoves,
  sqName,
  toFEN,
} from "./board";
import { chigorinBookKey } from "./chigorin-book";
import { nonPawnMaterial } from "./eval";
import { LEVEL_CFG, MATE, searchRootCandidates } from "./search";
import type { AiResult, Color, Level, Move, Position } from "./types";
export interface ChigorinPlan {
  mode: "develop" | "central-counterplay" | "coordinated-attack" | "knight-activity";
  target: string;
}
export interface ChigorinFeatures {
  homeMinors: number;
  knightActivity: number;
  outposts: number;
  centralPressure: number;
  lineAccess: number;
  attackers: number;
  areaSquares: number;
}
export interface ChigorinProgress {
  terms: {
    development: number;
    castle: number;
    queen: number;
    repeat: number;
    knights: number;
    outposts: number;
    centralPressure: number;
    centralBreak: number;
    lineAccess: number;
    attackers: number;
    areaSquares: number;
  };
  bonus: number;
}
export interface ChigorinDecision {
  result: AiResult;
  plan: ChigorinPlan;
  progress: ChigorinProgress | null;
  depth: number;
  neutralLoss: number;
  searchTimedOut: boolean;
  reason: "book" | "terminal" | "mate" | "plan" | "neutral" | "incomplete" | "deadline";
}
const book: Readonly<Record<string, readonly (string | number)[][]>> = bookData;
const enemy = (side: Color): Color => (side === "w" ? "b" : "w");
const home = (side: Color) => (side === "w" ? 7 : 0);
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
function homeMinors(position: Position, side: Color): number {
  return position.board.filter(
    (p, sq) => p?.[0] === side && "nb".includes(p[1]) && sq >> 3 === home(side),
  ).length;
}
function pawnAttacks(position: Position, side: Color, square: number): boolean {
  const row = (square >> 3) + (side === "w" ? 1 : -1),
    col = square & 7;
  return [-1, 1].some(
    (dc) => inside(row, col + dc) && position.board[row * 8 + col + dc] === `${side}p`,
  );
}
function sideMoves(position: Position, side: Color): Move[] {
  return legalMoves({
    ...position,
    turn: side,
    ep: position.turn === side ? position.ep : null,
  }).filter((m) => m.capture?.[1] !== "k");
}
/** Legal reach prevents pinned knights from earning mobility, outpost or attacking credit.
 * Outposts require pawn support and reject both existing enemy pawn attacks and legal one-move
 * pawn challenges. This deliberately conservative definition does not claim permanent immunity.
 */
export function chigorinFeatures(position: Position, side: Color): ChigorinFeatures {
  const moves = sideMoves(position, side),
    king = kingSq(position.board, enemy(side));
  const attackers = new Set<number>(),
    area = new Set<number>(),
    central = new Set<string>();
  const knightMoves = new Map<number, Move[]>();
  const lines = new Map<number, number>();
  for (const m of moves) {
    const kind = position.board[m.from]![1];
    if (kind === "n") knightMoves.set(m.from, [...(knightMoves.get(m.from) ?? []), m]);
    if ("brq".includes(kind)) lines.set(m.from, (lines.get(m.from) ?? 0) + 1);
    if (
      "nbrq".includes(kind) &&
      Math.abs((m.to >> 3) - (king >> 3)) <= 1 &&
      Math.abs((m.to & 7) - (king & 7)) <= 1
    ) {
      attackers.add(m.from);
      area.add(m.to);
    }
    if (
      "pnbrq".includes(kind) &&
      m.capture === `${enemy(side)}p` &&
      (m.to & 7) >= 2 &&
      (m.to & 7) <= 5 &&
      m.to >> 3 >= 2 &&
      m.to >> 3 <= 5
    )
      central.add(`${m.from}:${m.to}`);
  }
  let knightActivity = 0,
    outposts = 0;
  const pawnMoves = knightMoves.size
    ? sideMoves(position, enemy(side)).filter((m) => position.board[m.from]?.[1] === "p")
    : [];
  for (const [square, reach] of knightMoves) {
    const safe = reach.filter((m) => !pawnAttacks(position, enemy(side), m.to));
    knightActivity += safe.length;
    const row = square >> 3,
      col = square & 7,
      rank = side === "w" ? 7 - row : row;
    if (
      col >= 2 &&
      col <= 5 &&
      rank >= 3 &&
      rank <= 5 &&
      !pawnAttacks(position, enemy(side), square)
    ) {
      knightActivity += 4;
      if (
        pawnAttacks(position, side, square) &&
        !pawnMoves.some((m) =>
          pawnAttacks(
            applyMove(
              {
                ...position,
                turn: enemy(side),
                ep: position.turn === enemy(side) ? position.ep : null,
              },
              m,
            ),
            enemy(side),
            square,
          ),
        )
      )
        outposts++;
    }
  }
  return {
    homeMinors: homeMinors(position, side),
    knightActivity,
    outposts,
    centralPressure: central.size,
    lineAccess: [...lines.values()].reduce((s, n) => s + Math.min(8, n), 0),
    attackers: attackers.size,
    areaSquares: area.size,
  };
}
/** Recomputed from the board, never from a hidden remembered plan. */
export function chigorinPlan(
  position: Position,
  features = chigorinFeatures(position, position.turn),
): ChigorinPlan {
  const side = position.turn,
    king = kingSq(position.board, side),
    material = nonPawnMaterial(position.board)[side];
  if (position.fullmove <= 15 && features.homeMinors > 0 && material >= 1300)
    return { mode: "develop", target: "minor-development-and-castling" };
  const shieldRow = (king >> 3) + (side === "w" ? -1 : 1);
  const shield = [-1, 0, 1].filter(
    (dc) =>
      inside(shieldRow, (king & 7) + dc) &&
      position.board[shieldRow * 8 + (king & 7) + dc] === `${side}p`,
  ).length;
  const safeKing =
    shield >= 2 &&
    !inCheck(position, side) &&
    king >> 3 === home(side) &&
    [1, 2, 6].includes(king & 7);
  if (material >= 1300 && safeKing && features.homeMinors === 0)
    return { mode: "coordinated-attack", target: sqName(kingSq(position.board, enemy(side))) };
  if (
    material >= 650 &&
    position.board.some(
      (p, sq) =>
        p === `${enemy(side)}p` && (sq & 7) >= 2 && (sq & 7) <= 5 && sq >> 3 >= 2 && sq >> 3 <= 5,
    )
  )
    return { mode: "central-counterplay", target: "enemy-central-pawns" };
  return { mode: "knight-activity", target: "safe-central-squares" };
}
export function chigorinProgress(
  position: Position,
  move: Move,
  before = chigorinFeatures(position, position.turn),
  plan = chigorinPlan(position, before),
): ChigorinProgress {
  const side = position.turn,
    next = applyMove(position, move),
    after = chigorinFeatures(next, side),
    kind = position.board[move.from]![1];
  const terms = {
    development: 0,
    castle: 0,
    queen: 0,
    repeat: 0,
    knights: (after.knightActivity - before.knightActivity) * 10,
    outposts: (after.outposts - before.outposts) * 85,
    centralPressure: (after.centralPressure - before.centralPressure) * 45,
    centralBreak: 0,
    lineAccess: 0,
    attackers: 0,
    areaSquares: 0,
  };
  if (plan.mode === "develop") {
    terms.development = (before.homeMinors - after.homeMinors) * 100;
    terms.castle = move.castle ? 135 : 0;
    terms.queen = kind === "q" ? -85 : 0;
    terms.repeat = "nb".includes(kind) && move.from >> 3 !== home(side) ? -40 : 0;
  }
  // Central contact is useful when it frees a line or creates new legal pressure, not any pawn push.
  const contact =
    kind === "p" &&
    (move.to & 7) >= 2 &&
    (move.to & 7) <= 5 &&
    move.to >> 3 >= 2 &&
    move.to >> 3 <= 5 &&
    [-1, 1].some((dc) => {
      const r = (move.to >> 3) + (side === "w" ? -1 : 1),
        c = (move.to & 7) + dc;
      return inside(r, c) && next.board[r * 8 + c] === `${enemy(side)}p`;
    });
  if (
    plan.mode !== "develop" &&
    contact &&
    (after.lineAccess > before.lineAccess || after.centralPressure > before.centralPressure)
  ) {
    terms.centralBreak = 165;
    terms.lineAccess = Math.max(0, after.lineAccess - before.lineAccess) * 8;
  }
  if (plan.mode === "coordinated-attack") {
    terms.attackers = (after.attackers - before.attackers) * 115;
    terms.areaSquares = (after.areaSquares - before.areaSquares) * 6;
  }
  return {
    terms,
    bonus: Math.max(
      0,
      Math.min(
        240,
        Object.values(terms).reduce((s, n) => s + n, 0),
      ),
    ),
  };
}
// Stable per-position seeded randomness; book selection uses occurrence counts only.
function chigorinRandom(seed: number, position: Position, ply: number): number {
  let state = seed >>> 0;
  for (const character of `${toFEN(position)}:${ply}`)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let n = Math.imul(state ^ (state >>> 15), 1 | state);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function recordedMove(position: Position, legal: Move[], seed: number, ply: number): Move | null {
  const recorded = book[chigorinBookKey(position)];
  if (!recorded) return null;
  const byUci = new Map(
    legal.map((move) => [`${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`, move]),
  );
  const choices = recorded.flatMap(([uci, count]) => {
    const move = typeof uci === "string" ? byUci.get(uci) : undefined;
    return move && typeof count === "number" && Number.isSafeInteger(count) && count > 0
      ? [{ move, count }]
      : [];
  });
  if (!choices.length) return null;
  let target =
    chigorinRandom(seed, position, ply) * choices.reduce((sum, choice) => sum + choice.count, 0);
  for (const choice of choices) {
    target -= choice.count;
    if (target < 0) return choice.move;
  }
  return choices[choices.length - 1].move;
}

/** Actual production policy plus diagnostic metadata; no additional diagnostic searches. */
export function explainChigorinMove(
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now: () => number = () => performance.now(),
): ChigorinDecision {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid opponent seed.");
  if (!Number.isSafeInteger(ply) || ply < 0) throw new Error("Invalid opponent move identity.");
  const config = LEVEL_CFG[level],
    deadline = now() + config.ms,
    legal = legalMoves(position),
    sign = position.turn === "w" ? 1 : -1,
    before = chigorinFeatures(position, position.turn),
    plan = chigorinPlan(position, before);
  const base = { plan, progress: null, depth: 0, neutralLoss: 0, searchTimedOut: false };
  if (!legal.length)
    return {
      ...base,
      reason: "terminal",
      result: {
        move: null,
        score: inCheck(position, position.turn) ? -MATE * sign : 0,
        book: false,
      },
    };
  if (position.halfmove >= 100 || insufficientMaterial(position.board))
    return { ...base, reason: "terminal", result: { move: null, score: 0, book: false } };
  const recorded = recordedMove(position, legal, seed, ply);
  if (recorded)
    return { ...base, reason: "book", result: { move: recorded, score: null, book: true } };
  const roots = searchRootCandidates(
    position,
    config.depth,
    Math.max(0, deadline - now() - 30),
    now,
    deadline - 30,
  );
  const neutral: ChigorinDecision = {
    ...base,
    depth: roots.depth,
    searchTimedOut: roots.timedOut,
    reason: "neutral",
    result: { move: roots.fallback.move, score: roots.fallback.score, book: false },
  };
  if (!roots.candidates.length) return { ...neutral, reason: "incomplete" };
  if (Math.abs(roots.fallback.score) > MATE - 100) return { ...neutral, reason: "mate" };
  const best = roots.fallback.score * sign;
  const ranked: { move: Move; score: number; progress: ChigorinProgress; rank: number }[] = [];
  for (const candidate of roots.candidates) {
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    if (best - candidate.score > 100) continue;
    const progress = chigorinProgress(position, candidate.move, before, plan);
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    ranked.push({ ...candidate, progress, rank: candidate.score + progress.bonus });
  }
  if (!ranked.some((candidate) => candidate.progress.bonus > 0)) return neutral;
  ranked.sort((a, b) => b.rank - a.rank || b.score - a.score);
  const ties = ranked.filter(
    (candidate) => candidate.rank === ranked[0].rank && candidate.score === ranked[0].score,
  );
  const selected = ties[Math.floor(chigorinRandom(seed, position, ply) * ties.length)];
  if (now() >= deadline) return { ...neutral, reason: "deadline" };
  return {
    ...neutral,
    reason: selected.progress.bonus > 0 ? "plan" : "neutral",
    progress: selected.progress,
    neutralLoss: best - selected.score,
    result: { move: selected.move, score: selected.score * sign, book: false },
  };
}

export function chooseChigorinMove(
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now: () => number = () => performance.now(),
): AiResult {
  return explainChigorinMove(position, level, seed, ply, now).result;
}
