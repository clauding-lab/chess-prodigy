import {
  START,
  applyMove,
  legalMoves,
  posKey,
  sameMove,
  sanFor,
  toFEN,
} from "../../src/engine/board";
import type { Move, Position } from "../../src/engine/types";
import { terminalResult, type Score } from "../calibration/core";
import { isDeadPositionV2 } from "../../src/engine/rules-v2";
import { strengthBaselineConfig, type StrengthRow } from "./strength-core";
import { StrengthWorkerFailure, type StrengthFailureEvidence } from "./strength-failure";
import { experimentalRosterConfig } from "../../src/engine/opponents";

export const STRENGTH_MAX_PLIES = 1000;
// Both candidates use the new game rule; baseline move selection remains frozen v1.
const terminalForExperiment = (position: Position, keys: Map<string, number>) =>
  terminalResult(position, keys) ??
  (isDeadPositionV2(position.board)
    ? { score: 0.5 as const, reason: "insufficient-material" as const }
    : null);
export interface Decision {
  move: Move;
  startupMs: number;
  calculationMs: number;
  detail: unknown;
}
export type StrengthChooser = (
  position: Position,
  history: readonly string[],
  moves: readonly string[],
  candidate: boolean,
) => Promise<Decision>;
export interface StrengthGame {
  row: StrengthRow;
  moves: string[];
  fen: string;
  score: Score | null;
  reason: string;
  failure: string | null;
  failureEvidence?: StrengthFailureEvidence;
  decisions: Omit<Decision, "move">[];
  elapsedMs: number;
}
export async function playStrengthGame(
  row: StrengthRow,
  choose: StrengthChooser,
): Promise<StrengthGame> {
  const started = performance.now(),
    history: string[] = [],
    moves: string[] = [],
    decisions: StrengthGame["decisions"] = [];
  let position = START();
  const keys = new Map([[posKey(position), 1]]);
  let failureEvidence: StrengthFailureEvidence | undefined;
  const finish = (
    score: Score | null,
    reason: string,
    failure: string | null = null,
  ): StrengthGame => ({
    row,
    moves,
    fen: toFEN(position),
    score,
    reason,
    failure,
    ...(failureEvidence ? { failureEvidence } : {}),
    decisions,
    elapsedMs: performance.now() - started,
  });
  for (;;) {
    const terminal = terminalForExperiment(position, keys);
    if (terminal)
      return finish(
        (row.color === "w" ? terminal.score : 1 - terminal.score) as Score,
        terminal.reason,
      );
    if (moves.length >= STRENGTH_MAX_PLIES) return finish(null, "capacity-limit");
    let decision: Decision;
    try {
      decision = await choose(
        structuredClone(position),
        [...history],
        [...moves],
        position.turn === row.color,
      );
      if (!decision.move || !legalMoves(position).some((move) => sameMove(move, decision.move)))
        throw new Error("Illegal or missing decision");
      const canonical = legalMoves(position).find((move) => sameMove(move, decision.move))!;
      const signature = (move: Move) =>
        JSON.stringify([
          move.from,
          move.to,
          move.promo,
          move.capture,
          move.ep,
          move.double,
          move.castle,
        ]);
      if (signature(canonical) !== signature(decision.move))
        throw new Error("Invalid move metadata");
      if (![decision.startupMs, decision.calculationMs].every((n) => Number.isFinite(n) && n >= 0))
        throw new Error("Invalid decision timing");
    } catch (error) {
      if (error instanceof StrengthWorkerFailure) failureEvidence = error.evidence;
      return finish(
        null,
        "decision-failure",
        error instanceof Error ? error.message : String(error),
      );
    }
    const next = applyMove(position, decision.move);
    history.push(toFEN(position));
    moves.push(sanFor(position, decision.move, next));
    decisions.push({
      startupMs: decision.startupMs,
      calculationMs: decision.calculationMs,
      detail: decision.detail,
    });
    position = next;
    const key = posKey(position);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
}
export function verifyStrengthGame(
  value: unknown,
  row: StrengthRow,
): asserts value is StrengthGame {
  if (!value || typeof value !== "object") throw new Error("Missing game");
  const game = value as StrengthGame;
  if (
    JSON.stringify(game.row) !== JSON.stringify(row) ||
    !Array.isArray(game.moves) ||
    game.moves.length > STRENGTH_MAX_PLIES ||
    !Array.isArray(game.decisions) ||
    game.decisions.length !== game.moves.length ||
    !Number.isFinite(game.elapsedMs) ||
    game.elapsedMs < 0
  )
    throw new Error("Invalid game identity or shape");
  let position = START();
  const keys = new Map([[posKey(position), 1]]);
  const priorHistory: string[] = [];
  for (let ply = 0; ply < game.moves.length; ply++) {
    if (terminalForExperiment(position, keys)) throw new Error("Move after terminal position");
    const move = legalMoves(position).find(
      (m) => sanFor(position, m, applyMove(position, m)) === game.moves[ply],
    );
    if (!move) throw new Error("Illegal recorded move");
    const decision = game.decisions[ply];
    if (
      !decision ||
      ![decision.startupMs, decision.calculationMs].every((n) => Number.isFinite(n) && n >= 0)
    )
      throw new Error("Invalid timing record");
    priorHistory.push(toFEN(position));
    position = applyMove(position, move);
    const key = posKey(position);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  if (game.fen !== toFEN(position)) throw new Error("Position mismatch");
  const evidence = game.failureEvidence;
  if (evidence !== undefined) {
    const candidate = position.turn === row.color;
    const opponent = candidate
      ? experimentalRosterConfig(row.candidate, row.seed)
      : strengthBaselineConfig(row.baseline, row.baselineSeed);
    const timing = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0;
    if (
      !evidence ||
      evidence.version !== 1 ||
      game.reason !== "decision-failure" ||
      game.score !== null ||
      !["startup", "calculation", "reply-validation", "decision"].includes(evidence.stage) ||
      evidence.request?.gameId !== row.key ||
      evidence.request.revision !== game.moves.length ||
      evidence.request.requestId !== game.moves.length + 1 ||
      evidence.request.level !== row.level ||
      !evidence.request.opponent ||
      !Object.entries(opponent).every(
        ([key, value]) => evidence.request.opponent[key as keyof typeof opponent] === value,
      ) ||
      (candidate &&
        (JSON.stringify(evidence.request.history) !== JSON.stringify(priorHistory) ||
          evidence.request.turnDeadline !== null)) ||
      !evidence.request.position ||
      toFEN(evidence.request.position) !== game.fen ||
      !timing(evidence.elapsedMs) ||
      evidence.capacityMs !== 15000 ||
      (evidence.stage === "startup"
        ? evidence.startupMs !== null || evidence.calculationMs !== null
        : !timing(evidence.startupMs) || !timing(evidence.calculationMs)) ||
      (evidence.exitCode !== null && !Number.isInteger(evidence.exitCode)) ||
      (evidence.replyV8Base64 !== undefined &&
        (typeof evidence.replyV8Base64 !== "string" || !evidence.replyV8Base64.length))
    )
      throw new Error("Invalid failure evidence");
  }
  const terminal = terminalForExperiment(position, keys);
  if (terminal) {
    if (
      game.score !== (row.color === "w" ? terminal.score : 1 - terminal.score) ||
      game.reason !== terminal.reason ||
      game.failure !== null
    )
      throw new Error("Terminal result mismatch");
  } else if (
    game.score !== null ||
    !(
      (game.reason === "capacity-limit" &&
        game.moves.length === STRENGTH_MAX_PLIES &&
        game.failure === null) ||
      (game.reason === "decision-failure" &&
        typeof game.failure === "string" &&
        game.failure.length > 0)
    )
  )
    throw new Error("Unresolved game cannot count as a result");
}
