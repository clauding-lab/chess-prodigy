import { inCheck, legalMoves, sqName, toFEN } from "../board";
import { isExperimentalOpponent, type OpponentConfig } from "../opponents";
import { rosterBookKey } from "../roster/book";
import { rosterRandom } from "../roster/policy";
import type { RosterBook } from "../roster/types";
import type { Level, Move, Position } from "../types";
import { searchNextShortlistReuse, type NextSearchResult } from "./shortlist-reuse-search";
import {
  deriveExperimentPlan,
  rankExperimentMove,
  type ExperimentId,
  type ExperimentPlan,
} from "./plans";
export const EXPERIMENT_POLICY = "coherent-roster-v1";
export const EXPERIMENT_BUDGETS = { casual: 200, club: 600, strong: 2000 } as const;
export const EXPERIMENT_LOSS = { tal: 100, fischer: 50 } as const;
export interface ExperimentDecision {
  policy: typeof EXPERIMENT_POLICY;
  opponent: OpponentConfig;
  position: string;
  history: string;
  kind: "book" | "move" | "terminal" | "incomplete";
  move: Move | null;
  score: number | null;
  book: boolean;
  plan: ExperimentPlan | null;
  neutralLoss: number | null;
  sourceCount: number | null;
  search: NextSearchResult | null;
  elapsedMs: number;
}
export function decideExperiment(
  position: Position,
  history: readonly string[],
  opponent: OpponentConfig,
  level: Level,
  book: RosterBook,
  options: { now?: () => number; remainingMs?: number; maxNodes?: number } = {},
): ExperimentDecision {
  if (!isExperimentalOpponent(opponent) || !Object.hasOwn(EXPERIMENT_BUDGETS, level))
    throw new Error("Experimental opponent is unavailable.");
  if (
    options.remainingMs !== undefined &&
    (!Number.isFinite(options.remainingMs) || options.remainingMs < 0)
  )
    throw new Error("Invalid remaining time.");
  const now = options.now ?? (() => performance.now()),
    started = now(),
    deadline = started + Math.min(EXPERIMENT_BUDGETS[level], options.remainingMs ?? Infinity);
  const searchOptions = {
    maxDepth: 8,
    now,
    candidateWindowCp: 100,
    forcingSafetyPlies: 12,
    maxNodes: options.maxNodes,
  };
  // The zero-budget preflight preserves terminal-before-book semantics and produces explicit
  // no-move evidence if startup/history preparation exhausts the turn budget.
  const initial = searchNextShortlistReuse(position, history, { ...searchOptions, ms: 0 });
  const common = {
    policy: EXPERIMENT_POLICY,
    opponent: { ...opponent },
    position: toFEN(position),
    history: initial.history,
    plan: null,
    neutralLoss: null,
    sourceCount: null,
    book: false,
  } as const;
  const finish = (value: Omit<ExperimentDecision, "elapsedMs">): ExperimentDecision => ({
    ...value,
    elapsedMs: Math.max(0, now() - started),
  });
  const incomplete = () =>
    finish({ ...common, kind: "incomplete", move: null, score: null, search: initial });
  if (initial.kind === "terminal")
    return finish({
      ...common,
      kind: "terminal",
      move: null,
      score: initial.score,
      search: initial,
    });
  if (now() >= deadline) return incomplete();
  const legal = legalMoves(position),
    byUci = new Map(
      legal.map((move) => [`${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`, move]),
    );
  const choices = (book[rosterBookKey(position)] ?? []).flatMap(([uci, count]) => {
    const move = typeof uci === "string" ? byUci.get(uci) : undefined;
    return move && typeof count === "number" && Number.isSafeInteger(count) && count > 0
      ? [{ move, count }]
      : [];
  });
  if (now() >= deadline) return incomplete();
  if (choices.length) {
    let weight =
      rosterRandom(opponent.seed!, position, history.length) *
      choices.reduce((sum, item) => sum + item.count, 0);
    const choice =
      choices.find((item) => (weight -= item.count) < 0) ?? choices[choices.length - 1];
    if (now() >= deadline) return incomplete();
    return finish({
      ...common,
      kind: "book",
      move: choice.move,
      score: null,
      book: true,
      sourceCount: choice.count,
      search: null,
    });
  }
  const evidence = searchNextShortlistReuse(position, history, {
    ...searchOptions,
    ms: Math.max(0, deadline - now() - 30),
    absoluteDeadline: deadline - 30,
  });
  if (evidence.kind !== "completed")
    return finish({
      ...common,
      kind: evidence.kind,
      move: null,
      score: evidence.score,
      search: evidence,
    });
  const neutral = (): ExperimentDecision =>
    finish({
      ...common,
      kind: "move",
      move: evidence.move,
      score: evidence.score,
      neutralLoss: 0,
      search: evidence,
    });
  if (now() >= deadline || Math.abs(evidence.score) > 90000 || inCheck(position, position.turn))
    return neutral();
  const id = opponent.id as ExperimentId,
    sign = position.turn === "w" ? 1 : -1,
    plan = deriveExperimentPlan(id, position, history);
  const ranked: Array<{ move: Move; score: number; loss: number; rank: number }> = [];
  for (const candidate of evidence.candidates) {
    if (now() >= deadline) return neutral();
    if (candidate.kind !== "exact") continue;
    const loss = (evidence.score - candidate.score) * sign;
    if (loss < 0 || loss > EXPERIMENT_LOSS[id]) continue;
    const bonus = rankExperimentMove(position, candidate.move, plan);
    if (now() >= deadline) return neutral();
    ranked.push({
      move: candidate.move,
      score: candidate.score,
      loss,
      rank: candidate.score * sign + bonus,
    });
  }
  if (!ranked.length) return neutral();
  ranked.sort((a, b) => b.rank - a.rank || a.loss - b.loss);
  const ties = ranked.filter(
    (item) => item.rank === ranked[0].rank && item.loss === ranked[0].loss,
  );
  const selected =
    ties[Math.floor(rosterRandom(opponent.seed!, position, history.length) * ties.length)];
  if (now() >= deadline) return neutral();
  return finish({
    ...common,
    kind: "move",
    move: selected.move,
    score: selected.score,
    neutralLoss: selected.loss,
    plan,
    search: evidence,
  });
}
