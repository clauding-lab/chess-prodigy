import { legalMoves, toFEN } from "../../engine/board";
import { isExperimentalOpponent, type OpponentConfig } from "../../engine/opponents";
import {
  EXPERIMENT_POLICY,
  EXPERIMENT_LOSS,
  type ExperimentDecision,
} from "../../engine/next/roster";
import { deriveExperimentPlan, type ExperimentId } from "../../engine/next/plans";
import type { Level, Position, Move } from "../../engine/types";
import {
  isNextResult,
  nextHistoryIdentity,
  nextRootTerminal,
  NEXT_WORKER_POLICY,
} from "./protocol";
export interface ExperimentInput {
  gameId: string;
  revision: number;
  position: Position;
  history: string[];
  level: Level;
  opponent: OpponentConfig;
  turnDeadline: number | null;
}
export type ExperimentRequest = ExperimentInput & { requestId: number };
const moveKey = (m: Move) =>
  JSON.stringify([m.from, m.to, m.promo, m.capture, m.ep, m.double, m.castle]);
export function isExperimentResult(
  value: unknown,
  request: ExperimentRequest,
): value is ExperimentDecision {
  try {
    const result = value as ExperimentDecision;
    if (
      !result ||
      result.policy !== EXPERIMENT_POLICY ||
      !isExperimentalOpponent(result.opponent) ||
      !["id", "version", "engine", "randomPolicy", "seed"].every(
        (key) =>
          result.opponent[key as keyof OpponentConfig] ===
          request.opponent[key as keyof OpponentConfig],
      ) ||
      result.position !== toFEN(request.position) ||
      result.history !== nextHistoryIdentity(request.history) ||
      !Number.isFinite(result.elapsedMs) ||
      result.elapsedMs < 0
    )
      return false;
    const legal = legalMoves(request.position),
      isLegal = result.move !== null && legal.some((m) => moveKey(m) === moveKey(result.move!));
    if (result.kind === "book")
      return (
        isLegal &&
        nextRootTerminal(request.position, request.history, legal) === null &&
        result.book === true &&
        result.score === null &&
        result.plan === null &&
        result.neutralLoss === null &&
        result.search === null &&
        Number.isSafeInteger(result.sourceCount) &&
        result.sourceCount! > 0
      );
    if (
      result.book !== false ||
      result.sourceCount !== null ||
      !isNextResult(result.search, { ...request, policy: NEXT_WORKER_POLICY })
    )
      return false;
    const search = result.search;
    if (result.kind === "terminal" || result.kind === "incomplete")
      return (
        result.kind === search.kind &&
        result.move === null &&
        result.score === search.score &&
        result.plan === null &&
        result.neutralLoss === null
      );
    if (
      result.kind !== "move" ||
      search.kind !== "completed" ||
      !isLegal ||
      !Number.isFinite(result.score) ||
      !Number.isFinite(result.neutralLoss)
    )
      return false;
    const sign = request.position.turn === "w" ? 1 : -1,
      loss = (search.score - result.score!) * sign;
    if (
      loss !== result.neutralLoss ||
      loss < 0 ||
      loss > EXPERIMENT_LOSS[request.opponent.id as ExperimentId] ||
      !search.candidates.some(
        (c) =>
          c.kind === "exact" &&
          c.score === result.score &&
          moveKey(c.move) === moveKey(result.move!),
      )
    )
      return false;
    if (result.plan === null) return loss === 0 && moveKey(result.move!) === moveKey(search.move);
    return (
      JSON.stringify(result.plan) ===
      JSON.stringify(
        deriveExperimentPlan(
          request.opponent.id as ExperimentId,
          request.position,
          request.history,
        ),
      )
    );
  } catch {
    return false;
  }
}
