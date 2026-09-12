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
import { morphyConfig } from "../../src/engine/opponents";
import { bookLookup } from "../../src/book/book";
import type { Color, Level } from "../../src/engine/types";
import { terminalScore, seededRandom } from "./core";
export interface MatchOptions {
  level: Level;
  morphyColor: Color;
  seed: number;
  opening: readonly string[];
  maxPlies: number;
}
export function playMatch(options: MatchOptions) {
  const started = performance.now(),
    opponent = morphyConfig(options.seed),
    random = seededRandom(options.seed ^ 0x4b731);
  let position = START();
  const moves: string[] = [],
    keys = new Map([[posKey(position), 1]]);
  let morphyMs = 0,
    classicMs = 0;
  for (;;) {
    const whiteScore = terminalScore(position, keys);
    if (whiteScore !== null || moves.length >= options.maxPlies)
      return {
        ...options,
        moves,
        fen: toFEN(position),
        terminal: whiteScore !== null,
        score:
          whiteScore === null
            ? null
            : options.morphyColor === "w"
              ? whiteScore
              : ((1 - whiteScore) as 0 | 0.5 | 1),
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
