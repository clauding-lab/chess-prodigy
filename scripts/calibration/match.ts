import {
  START,
  applyMove,
  legalMoves,
  sameMove,
  sanFor,
  toFEN,
  posKey,
} from "../../src/engine/board";
import { chooseAiMove } from "../../src/engine/search";
import { chooseOpponentMove } from "../../src/engine/morphy";
import { historicalMorphyConfig, morphyConfig } from "../../src/engine/opponents";
import { bookLookup } from "../../src/book/book";
import type { Color, Level } from "../../src/engine/types";
import { terminalResult, seededRandom } from "./core";
export interface MatchOptions {
  protocol?: "morphy-paired-v1" | "morphy-historical-paired-v1";
  opponentVersion?: 1 | 3;
  level: Level;
  morphyColor: Color;
  seed: number;
  opening: readonly string[];
  maxPlies: number;
}
function opponentForOptions(options: MatchOptions) {
  if (
    options.protocol !== undefined &&
    options.protocol !== "morphy-paired-v1" &&
    options.protocol !== "morphy-historical-paired-v1"
  )
    throw new Error(`Unsupported calibration protocol: ${String(options.protocol)}`);
  if (
    (options.protocol === "morphy-historical-paired-v1" && options.opponentVersion !== 3) ||
    (options.protocol === "morphy-paired-v1" && options.opponentVersion !== 1) ||
    (options.protocol === undefined && options.opponentVersion !== undefined)
  )
    throw new Error("Calibration protocol and opponent version mismatch");
  if (options.protocol === "morphy-historical-paired-v1" && options.opening.length !== 0)
    throw new Error("Historical calibration must start from START with an empty opening");
  return options.protocol === "morphy-historical-paired-v1"
    ? historicalMorphyConfig(options.seed)
    : morphyConfig(options.seed);
}

export function playMatch(options: MatchOptions) {
  const started = performance.now(),
    opponent = opponentForOptions(options),
    random = seededRandom(options.seed ^ 0x4b731);
  let position = START();
  const moves: string[] = [],
    keys = new Map([[posKey(position), 1]]);
  let morphyMs = 0,
    classicMs = 0;
  for (;;) {
    const terminal = terminalResult(position, keys);
    if (terminal !== null || moves.length >= options.maxPlies)
      return {
        ...options,
        opponent,
        moves,
        fen: toFEN(position),
        terminal: terminal !== null,
        resultReason: terminal?.reason ?? "unresolved-ply-bound",
        score:
          terminal === null
            ? null
            : options.morphyColor === "w"
              ? terminal.score
              : ((1 - terminal.score) as 0 | 0.5 | 1),
        elapsedMs: performance.now() - started,
        morphyMs,
        classicMs,
      };
    const legal = legalMoves(position),
      forced = options.opening[moves.length],
      isMorphy = position.turn === options.morphyColor;
    const moveStart = performance.now();
    const candidate = forced
      ? legal.find((m) => sanFor(position, m, applyMove(position, m)) === forced)
      : (isMorphy
          ? chooseOpponentMove(
              position,
              options.level,
              bookLookup(moves).replies,
              opponent,
              moves.length,
            )
          : chooseAiMove(position, options.level, bookLookup(moves).replies, undefined, random)
        ).move;
    if (!forced) {
      if (isMorphy) morphyMs += performance.now() - moveStart;
      else classicMs += performance.now() - moveStart;
    }
    if (!candidate || !legal.some((m) => sameMove(m, candidate)))
      throw new Error(`Illegal move at ply ${moves.length}: ${forced ?? "engine"}`);
    const next = applyMove(position, candidate);
    moves.push(sanFor(position, candidate, next));
    position = next;
    const key = posKey(position);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
}

export type MatchResult = ReturnType<typeof playMatch>;

export function verifySavedMatch(
  game: unknown,
  options: MatchOptions,
): asserts game is MatchResult {
  if (!game || typeof game !== "object" || Array.isArray(game))
    throw new Error("Saved match is invalid");
  const saved = game as MatchResult;
  opponentForOptions(options);
  for (const key of Object.keys(options) as (keyof MatchOptions)[])
    if (JSON.stringify(saved[key]) !== JSON.stringify(options[key]))
      throw new Error("Saved match identity mismatch");
  if (JSON.stringify(saved.opponent) !== JSON.stringify(opponentForOptions(options)))
    throw new Error("Saved opponent identity mismatch");
  if (
    !Array.isArray(saved.moves) ||
    saved.moves.some((move) => typeof move !== "string") ||
    saved.moves.length > options.maxPlies
  )
    throw new Error("Invalid saved moves");
  for (const timing of [saved.elapsedMs, saved.morphyMs, saved.classicMs])
    if (typeof timing !== "number" || !Number.isFinite(timing) || timing < 0)
      throw new Error("Invalid saved timing");
  let position = START();
  const keys = new Map([[posKey(position), 1]]);
  for (let i = 0; i < saved.moves.length; i++) {
    if (terminalResult(position, keys) !== null) throw new Error("Moves after game end");
    if (i < options.opening.length && saved.moves[i] !== options.opening[i])
      throw new Error("Opening mismatch");
    const move = legalMoves(position).find(
      (candidate) => sanFor(position, candidate, applyMove(position, candidate)) === saved.moves[i],
    );
    if (!move) throw new Error("Illegal saved match");
    position = applyMove(position, move);
    const key = posKey(position);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  const terminal = terminalResult(position, keys),
    score =
      terminal === null ? null : options.morphyColor === "w" ? terminal.score : 1 - terminal.score,
    reason = terminal?.reason ?? "unresolved-ply-bound";
  if (
    saved.fen !== toFEN(position) ||
    saved.score !== score ||
    saved.resultReason !== reason ||
    saved.terminal !== (terminal !== null) ||
    (terminal === null && saved.moves.length !== options.maxPlies)
  )
    throw new Error("Saved result mismatch");
}
