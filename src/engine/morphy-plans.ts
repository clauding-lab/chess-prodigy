import bookData from "../book/morphy-book.json";
import {
  applyMove,
  inCheck,
  insufficientMaterial,
  kingSq,
  legalMoves,
  posKey,
  sqName,
  toFEN,
} from "./board";
import { nonPawnMaterial } from "./eval";
import { LEVEL_CFG, MATE, searchRootCandidates } from "./search";
import type { AiResult, Color, Level, Move, Position } from "./types";

export type MorphyPlan = "develop" | "open-centre" | "king-attack" | "active-pieces";
export interface PlanGoal {
  mode: MorphyPlan;
  target: string;
}
export interface PlanFeatures {
  homeMinors: number;
  attackers: number;
  areaSquares: number;
  rookFiles: number;
  lineAccess: number;
}
export interface PlanProgress {
  terms: {
    development: number;
    castle: number;
    repeat: number;
    queen: number;
    centralBreak: number;
    lineAccess: number;
    attackers: number;
    areaSquares: number;
    rookFiles: number;
  };
  bonus: number;
}
export interface PlannedDecision {
  result: AiResult;
  plan: PlanGoal;
  progress: PlanProgress | null;
  depth: number;
  neutralLoss: number;
  searchTimedOut: boolean;
  reason: "book" | "terminal" | "mate" | "plan" | "neutral" | "incomplete" | "deadline";
}
const book: Readonly<Record<string, readonly (string | number)[][]>> = bookData;
const enemy = (side: Color): Color => (side === "w" ? "b" : "w");
const home = (side: Color): number => (side === "w" ? 7 : 0);
function homeMinors(position: Position, side: Color): number {
  return position.board.filter(
    (piece, sq) =>
      piece?.[0] === side && (piece[1] === "n" || piece[1] === "b") && sq >> 3 === home(side),
  ).length;
}

/** Pure board-derived goal; there is intentionally no remembered session plan. */
export function morphyPlan(position: Position): PlanGoal {
  const side = position.turn,
    king = kingSq(position.board, side),
    otherKing = kingSq(position.board, enemy(side));
  const count = position.board.filter(
    (piece) => piece?.[0] === side && "nbrq".includes(piece[1]),
  ).length;
  if (count < 3 || nonPawnMaterial(position.board)[side] < 1300)
    return { mode: "active-pieces", target: "board" };
  const undeveloped = homeMinors(position, side);
  if (position.fullmove <= 15 && undeveloped > 0)
    return { mode: "develop", target: "home-minors-and-castling" };
  if (
    undeveloped === 0 &&
    king >> 3 === home(side) &&
    [0, 1, 2, 6, 7].includes(king & 7) &&
    [3, 4].includes(otherKing & 7) &&
    position.board.some((piece, sq) => piece === `${side}p` && [3, 4].includes(sq & 7))
  )
    return { mode: "open-centre", target: "d/e-files" };
  return { mode: "king-attack", target: sqName(otherKing) };
}

/** Legal reach rather than pseudo-attacks excludes pinned/non-contributing attackers. */
export function planFeatures(position: Position, side: Color): PlanFeatures {
  const king = kingSq(position.board, enemy(side)),
    attackers = new Set<number>(),
    area = new Set<number>();
  // When evaluating the mover after a move, en passant belongs to the opponent only.
  const moves = legalMoves({
    ...position,
    turn: side,
    ep: position.turn === side ? position.ep : null,
  });
  const access = new Map<number, number>(),
    files = new Map<number, number>();
  for (const move of moves) {
    if (move.capture?.[1] === "k") continue;
    const kind = position.board[move.from]![1];
    if (
      "nbrq".includes(kind) &&
      Math.abs((move.to >> 3) - (king >> 3)) <= 1 &&
      Math.abs((move.to & 7) - (king & 7)) <= 1
    ) {
      attackers.add(move.from);
      area.add(move.to);
    }
    if (kind === "b" || kind === "r") access.set(move.from, (access.get(move.from) ?? 0) + 1);
    if (kind === "r" && (move.from & 7) === (move.to & 7))
      files.set(move.from, (files.get(move.from) ?? 0) + 1);
  }
  let rookFiles = 0;
  for (const [square, reach] of files)
    if (
      reach >= 3 &&
      !position.board.some((piece, sq) => (sq & 7) === (square & 7) && piece === `${side}p`)
    )
      rookFiles++;
  return {
    homeMinors: homeMinors(position, side),
    attackers: attackers.size,
    areaSquares: area.size,
    rookFiles,
    lineAccess: [...access.values()].reduce((sum, n) => sum + Math.min(8, n), 0),
  };
}

export function planProgress(position: Position, move: Move): PlanProgress {
  const side = position.turn,
    goal = morphyPlan(position),
    before = planFeatures(position, side),
    next = applyMove(position, move),
    after = planFeatures(next, side),
    kind = position.board[move.from]![1];
  const terms = {
    development: 0,
    castle: 0,
    repeat: 0,
    queen: 0,
    centralBreak: 0,
    lineAccess: 0,
    attackers: 0,
    areaSquares: 0,
    rookFiles: 0,
  };
  if (goal.mode === "develop") {
    terms.development = (before.homeMinors - after.homeMinors) * 110;
    terms.castle = move.castle ? 140 : 0;
    terms.repeat = (kind === "n" || kind === "b") && move.from >> 3 !== home(side) ? -35 : 0;
    terms.queen = kind === "q" ? -80 : 0;
  } else if (goal.mode === "open-centre") {
    const row = move.to >> 3,
      col = move.to & 7,
      forward = row + (side === "w" ? -1 : 1);
    const contact = [-1, 1].some(
      (dc) =>
        col + dc >= 0 &&
        col + dc < 8 &&
        forward >= 0 &&
        forward < 8 &&
        next.board[forward * 8 + col + dc] === `${enemy(side)}p`,
    );
    terms.centralBreak =
      kind === "p" &&
      [3, 4].includes(move.from & 7) &&
      row >= 2 &&
      row <= 5 &&
      (move.capture || move.double || contact)
        ? 150
        : 0;
    terms.lineAccess = (after.lineAccess - before.lineAccess) * 10;
    terms.attackers = (after.attackers - before.attackers) * 25;
  } else if (goal.mode === "king-attack") {
    terms.attackers = (after.attackers - before.attackers) * 80;
    terms.areaSquares = (after.areaSquares - before.areaSquares) * 8;
    terms.rookFiles = (after.rookFiles - before.rookFiles) * 50;
  }
  return {
    terms,
    bonus: Math.max(
      0,
      Math.min(
        240,
        Object.values(terms).reduce((a, b) => a + b, 0),
      ),
    ),
  };
}

// Exact historical-v1 hash and occurrence-selection convention; old implementation stays frozen.
function plannedRandom(seed: number, position: Position, ply: number): number {
  let state = seed >>> 0;
  for (const character of `${toFEN(position)}:${ply}`)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let n = Math.imul(state ^ (state >>> 15), 1 | state);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function recordedMove(position: Position, legal: Move[], seed: number, ply: number): Move | null {
  const recorded = book[posKey(position)];
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
    plannedRandom(seed, position, ply) * choices.reduce((sum, choice) => sum + choice.count, 0);
  for (const choice of choices) {
    target -= choice.count;
    if (target < 0) return choice.move;
  }
  return choices[choices.length - 1].move;
}

/** Actual production policy plus diagnostic metadata; no additional diagnostic searches. */
export function explainPlannedMove(
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now: () => number = () => performance.now(),
): PlannedDecision {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid opponent seed.");
  if (!Number.isSafeInteger(ply) || ply < 0) throw new Error("Invalid opponent move identity.");
  const config = LEVEL_CFG[level],
    deadline = now() + config.ms,
    legal = legalMoves(position),
    sign = position.turn === "w" ? 1 : -1,
    plan = morphyPlan(position);
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
  const neutral: PlannedDecision = {
    ...base,
    depth: roots.depth,
    searchTimedOut: roots.timedOut,
    reason: "neutral",
    result: { move: roots.fallback.move, score: roots.fallback.score, book: false },
  };
  if (!roots.candidates.length) return { ...neutral, reason: "incomplete" };
  if (Math.abs(roots.fallback.score) > MATE - 100) return { ...neutral, reason: "mate" };
  if (plan.mode === "active-pieces") return neutral;
  const best = roots.fallback.score * sign;
  const ranked: { move: Move; score: number; progress: PlanProgress; rank: number }[] = [];
  for (const candidate of roots.candidates) {
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    if (best - candidate.score > 100) continue;
    const progress = planProgress(position, candidate.move);
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    ranked.push({ ...candidate, progress, rank: candidate.score + progress.bonus });
  }
  if (!ranked.some((candidate) => candidate.progress.bonus > 0)) return neutral;
  ranked.sort((a, b) => b.rank - a.rank || b.score - a.score);
  const ties = ranked.filter(
    (candidate) => candidate.rank === ranked[0].rank && candidate.score === ranked[0].score,
  );
  const selected = ties[Math.floor(plannedRandom(seed, position, ply) * ties.length)];
  if (now() >= deadline) return { ...neutral, reason: "deadline" };
  return {
    ...neutral,
    reason: selected.progress.bonus > 0 ? "plan" : "neutral",
    progress: selected.progress,
    neutralLoss: best - selected.score,
    result: { move: selected.move, score: selected.score * sign, book: false },
  };
}

export function choosePlannedMove(
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now: () => number = () => performance.now(),
): AiResult {
  return explainPlannedMove(position, level, seed, ply, now).result;
}
