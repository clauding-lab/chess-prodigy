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
import type { StrengthRow } from "./strength-core";

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
    position = applyMove(position, move);
    const key = posKey(position);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  if (game.fen !== toFEN(position)) throw new Error("Position mismatch");
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
