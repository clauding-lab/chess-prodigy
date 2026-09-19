import { inCheck, insufficientMaterial, legalMoves, sqName, toFEN } from "../board";
import { LEVEL_CFG, MATE, searchRootCandidates } from "../search";
import type { Level, Move, Position } from "../types";
import { rosterBookKey } from "./book";
import type { RosterBook, RosterDecision } from "./types";
export interface Preference {
  plan: string;
  bonus: (move: Move, neutralScore: number) => number;
}
export interface Policy {
  loss: number;
  cap: number;
  prepare: (position: Position) => Preference;
}
export function rosterRandom(seed: number, p: Position, ply: number): number {
  let state = seed >>> 0;
  for (const c of `${toFEN(p)}:${ply}`) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let n = Math.imul(state ^ (state >>> 15), 1 | state);
  n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
export function explainMove(
  p: Position,
  level: Level,
  seed: number,
  ply: number,
  book: RosterBook,
  policy: Policy,
  now: () => number = () => performance.now(),
): RosterDecision {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw Error("Invalid opponent seed.");
  if (!Number.isSafeInteger(ply) || ply < 0) throw Error("Invalid opponent move identity.");
  const cfg = LEVEL_CFG[level],
    deadline = now() + cfg.ms,
    legal = legalMoves(p),
    sign = p.turn === "w" ? 1 : -1;
  const base = { plan: "none", depth: 0, neutralLoss: 0, bonus: 0 };
  if (!legal.length)
    return {
      ...base,
      reason: "terminal",
      result: { move: null, score: inCheck(p, p.turn) ? -MATE * sign : 0, book: false },
    };
  if (p.halfmove >= 100 || insufficientMaterial(p.board))
    return { ...base, reason: "terminal", result: { move: null, score: 0, book: false } };
  const byUci = new Map(legal.map((m) => [`${sqName(m.from)}${sqName(m.to)}${m.promo ?? ""}`, m]));
  const choices = (book[rosterBookKey(p)] ?? []).flatMap(([uci, count]) => {
    const move = typeof uci === "string" ? byUci.get(uci) : undefined;
    return move && typeof count === "number" && Number.isSafeInteger(count) && count > 0
      ? [{ move, count }]
      : [];
  });
  if (choices.length) {
    let target = rosterRandom(seed, p, ply) * choices.reduce((s, c) => s + c.count, 0);
    const choice = choices.find((c) => (target -= c.count) < 0) ?? choices[choices.length - 1];
    return {
      ...base,
      plan: "documented",
      reason: "book",
      result: { move: choice.move, score: null, book: true },
    };
  }
  const roots = searchRootCandidates(
    p,
    cfg.depth,
    Math.max(0, deadline - now() - 30),
    now,
    deadline - 30,
  );
  const neutral: RosterDecision = {
    ...base,
    depth: roots.depth,
    reason: "neutral",
    result: { move: roots.fallback.move, score: roots.fallback.score, book: false },
  };
  if (!roots.candidates.length) return { ...neutral, reason: "incomplete" };
  if (Math.abs(roots.fallback.score) > MATE - 100) return { ...neutral, reason: "mate" };
  if (now() >= deadline) return { ...neutral, reason: "deadline" };
  const pref = policy.prepare(p),
    best = roots.fallback.score * sign;
  const ranked: Array<{ move: Move; score: number; bonus: number; rank: number }> = [];
  for (const candidate of roots.candidates) {
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    if (best - candidate.score > policy.loss) continue;
    const bonus = Math.max(0, Math.min(policy.cap, pref.bonus(candidate.move, candidate.score)));
    if (now() >= deadline) return { ...neutral, reason: "deadline" };
    ranked.push({ ...candidate, bonus, rank: candidate.score + bonus });
  }
  if (!ranked.some((x) => x.bonus > 0)) return { ...neutral, plan: pref.plan };
  ranked.sort((a, b) => b.rank - a.rank || b.score - a.score);
  const ties = ranked.filter((x) => x.rank === ranked[0].rank && x.score === ranked[0].score),
    selected = ties[Math.floor(rosterRandom(seed, p, ply) * ties.length)];
  if (now() >= deadline) return { ...neutral, reason: "deadline" };
  return {
    ...neutral,
    plan: pref.plan,
    reason: selected.bonus > 0 ? "plan" : "neutral",
    bonus: selected.bonus,
    neutralLoss: best - selected.score,
    result: { move: selected.move, score: selected.score * sign, book: false },
  };
}
