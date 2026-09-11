import { expect, it } from "vitest";
import {
  CLASSIC,
  morphyConfig,
  isSupportedOpponent,
  personalityBetaEnabled,
} from "../../src/engine/opponents";
import {
  freshSession,
  reduceSession,
  settleClock,
  settlePriorGame,
  settleRating,
} from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { parseSavedState } from "../../src/storage/schema";

function beta() {
  return reduceSession(freshSession(0, "initial"), {
    type: "new",
    id: "morphy",
    now: 0,
    setup: { playerColor: "w", level: "club", time: "5+0", opponent: morphyConfig(42) },
  });
}
function moved() {
  const s = beta();
  return reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
}

it("defaults to Classic and requires an exact opt-in for new beta selection", () => {
  expect(freshSession(0, "classic").game.opponent).toEqual(CLASSIC);
  for (const value of [undefined, "", "false", "1", "TRUE"])
    expect(personalityBetaEnabled(value)).toBe(false);
  expect(personalityBetaEnabled("true")).toBe(true);
  expect(isSupportedOpponent(morphyConfig(42))).toBe(true);
});

it("keeps beta resignation, clock expiry and abandonment unrated with no receipt", () => {
  const s = moved();
  for (const terminal of [
    reduceSession(s, { type: "resign", now: 2 }),
    reduceSession(s, { type: "tick", now: 400000 }),
    settlePriorGame(s, 2),
  ]) {
    expect(terminal.game.over).not.toBeNull();
    expect(terminal.game).toMatchObject({
      rated: false,
      ratingApplied: null,
      unratedReason: "beta",
      opponent: morphyConfig(42),
    });
    expect(terminal.rating).toEqual(s.rating);
    expect(parseSavedState(terminal)).toEqual(terminal);
    expect(settleRating(terminal, 500000).rating).toEqual(s.rating);
  }
});

it("records assistance separately and preserves the beta reason through undo and reset", () => {
  let s = reduceSession(moved(), { type: "resign", now: 2 });
  s = reduceSession(s, { type: "undo", now: 3 });
  s = reduceSession(s, { type: "hint" });
  s = reduceSession(s, { type: "resetRating" });
  expect(s.game).toMatchObject({
    rated: false,
    ratingApplied: null,
    unratedReason: "beta",
    hintUsed: true,
    takebackUsed: true,
  });
  expect(s.rating.games).toBe(0);
  expect(parseSavedState(s)).toEqual(s);
  const forged = { ...s, game: { ...s.game, rated: true, unratedReason: null } };
  expect(parseSavedState(forged)).toBeNull();
  expect(
    settleRating(
      { ...forged, game: { ...forged.game, over: { result: "1-0", reason: "Checkmate" } } },
      4,
    ).rating.games,
  ).toBe(0);
});

it("preserves unknown opponent versions as read-only through every mutating transition", () => {
  const s = moved();
  s.game.opponent.version = 99;
  const parsed = parseSavedState(s)!;
  expect(parsed).toEqual(s);
  expect(isSupportedOpponent(parsed.game.opponent)).toBe(false);
  for (const action of [
    { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 2 },
    { type: "tick", now: 400000 },
    { type: "resign", now: 2 },
    { type: "undo", now: 2 },
    { type: "hint" },
    { type: "resetRating" },
    { type: "new", setup: s.game.setup, id: "replacement", now: 400000 },
  ] as const)
    expect(reduceSession(parsed, action)).toBe(parsed);
  expect(settleClock(parsed.game, 400000)).toBe(parsed.game);
  expect(settlePriorGame(parsed, 400000)).toBe(parsed);
});
