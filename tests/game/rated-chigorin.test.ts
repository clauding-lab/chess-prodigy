import { expect, it } from "vitest";
import { chigorinConfig, isRatedOpponent } from "../../src/engine/opponents";
import { CHIGORIN_RATINGS, opponentPracticeRating } from "../../src/rating/opponents";
import { freshSession, reduceSession, settleRating } from "../../src/game/state";
import { legalMoves, sanFor, applyMove } from "../../src/engine/board";
import { parseSavedState } from "../../src/storage/schema";
import { parseGameRecord } from "../../src/account/records";
import { archiveGame, rivalrySummary, replayRecord } from "../../src/game/archive";

it("assigns only the accepted immutable ratings to the exact Chigorin identity", () => {
  const config = chigorinConfig(7);
  expect(CHIGORIN_RATINGS).toEqual({ casual: 1250, club: 1350, strong: 1625 });
  expect(isRatedOpponent(config)).toBe(true);
  expect(opponentPracticeRating(config, "club")).toBe(1350);
  for (const change of [
    { version: 2 },
    { engine: "plans-v1" },
    { id: "attack-development" },
    { randomPolicy: "ambient-v1" },
    { seed: null },
  ]) {
    expect(isRatedOpponent({ ...config, ...change })).toBe(false);
    expect(opponentPracticeRating({ ...config, ...change }, "club")).toBeNull();
  }
});
for (const level of ["casual", "club", "strong"] as const)
  it(`settles ${level} Chigorin once, keeps replay/rivalry identity and excludes assistance`, () => {
    let session = reduceSession(freshSession(0, "initial"), {
      type: "new",
      id: `chigorin-${level}`,
      now: 0,
      setup: { playerColor: "b", level, time: "none", opponent: chigorinConfig(7) },
    });
    expect(session.game.rated).toBe(true);
    for (const san of ["f3", "e5", "g4"]) {
      const candidate = legalMoves(session.game.st).find(
        (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
      )!;
      session = reduceSession(session, {
        type: "move",
        move: candidate,
        now: session.game.clockAt + 1,
        book: false,
      });
    }
    for (const assistance of ["hint", "undo"] as const) {
      const assisted = reduceSession(session, { type: assistance, now: 4 });
      const ended = reduceSession(assisted, { type: "resign", now: 5 });
      expect(ended.rating.games).toBe(0);
      expect(ended.game.unratedReason).toBe(assistance === "hint" ? "hint" : "takeback");
      expect(parseSavedState(ended)).toEqual(ended);
    }
    const mate = legalMoves(session.game.st).find(
      (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === "Qh4#",
    )!;
    const won = reduceSession(session, { type: "move", move: mate, now: 4, book: false });
    expect(won.rating.games).toBe(1);
    expect(won.rating.history.at(-1)).toMatchObject({
      opp: `Mikhail Chigorin · ${level[0].toUpperCase()}${level.slice(1)}`,
      oppRating: CHIGORIN_RATINGS![level],
      score: 1,
    });
    expect(parseSavedState(won)).toEqual(won);
    expect(settleRating(won, 99)).toBe(won);
    const record = archiveGame(won)!;
    expect(parseGameRecord(record)).toEqual(record);
    expect(record.opponent).toEqual(chigorinConfig(7));
    expect(replayRecord(record)?.moves).toHaveLength(4);
    expect(rivalrySummary([record], { opponent: chigorinConfig(9), level }).unassisted.wins).toBe(
      1,
    );
    expect(
      rivalrySummary([record], { opponent: { ...chigorinConfig(9), version: 2 }, level }).total,
    ).toBe(0);
    expect(reduceSession(won, { type: "undo", now: 5 }).rating).toEqual(session.rating);
  });
