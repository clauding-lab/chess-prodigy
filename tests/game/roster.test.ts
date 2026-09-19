import { unratedDescription } from "../../src/game/eligibility";
import { legalMoves } from "../../src/engine/board";
import { expect, test } from "vitest";
import {
  CLASSIC,
  ROSTER_IDS,
  rosterConfig,
  isOpponentConfig,
  isSupportedOpponent,
  isRatedOpponent,
  opponentName,
} from "../../src/engine/opponents";
import { ROSTER_RATINGS, opponentPracticeRating } from "../../src/rating/opponents";
import { freshSession, reduceSession } from "../../src/game/state";
import { parseSavedState } from "../../src/storage/schema";
import { parseGameRecord } from "../../src/account/records";
import { updateArchive } from "../../src/game/archive";
for (const id of ROSTER_IDS) {
  test(`${id} has exact supported identity and no unaccepted rating or receipt`, () => {
    const config = rosterConfig(id, 0xffffffff);
    expect(isOpponentConfig(config)).toBe(true);
    expect(isSupportedOpponent(config)).toBe(true);
    expect(opponentName(config)).not.toContain("Unavailable");
    expect(ROSTER_RATINGS[id]).toBeNull();
    expect(isRatedOpponent(config)).toBe(false);
    for (const level of ["casual", "club", "strong"] as const) {
      expect(opponentPracticeRating(config, level)).toBeNull();
      const game = reduceSession(freshSession(0, "before"), {
        type: "new",
        id,
        now: 0,
        setup: { playerColor: "w", level, time: "none", opponent: config },
      });
      expect(game.game.rated).toBe(false);
      expect(unratedDescription(game.game)).toContain("strength measurement is not yet accepted");
      expect(parseSavedState(game)?.game.opponent).toEqual(config);
      const moved = reduceSession(game, {
        type: "move",
        move: legalMoves(game.game.st)[0],
        book: false,
        now: 1,
      });
      const end = reduceSession(moved, { type: "resign", now: 2 });
      expect(end.rating).toEqual(game.rating);
      expect(parseGameRecord(updateArchive([], end)[0])?.opponent).toEqual(config);
      expect(parseSavedState({ ...game, game: { ...game.game, rated: true } })).toBeNull();
    }
  });
  test(`${id} rejects unknown versions, engines, policies and seeds without Classic substitution`, () => {
    for (const change of [
      { version: 2 },
      { engine: "classic-v1" },
      { randomPolicy: "ambient-v1" },
      { seed: null },
      { seed: -1 },
      { seed: 0x100000000 },
      { seed: 1.2 },
      { seed: NaN },
    ])
      expect(isSupportedOpponent({ ...rosterConfig(id, 1), ...change })).toBe(false);
    for (const seed of [-1, 0x100000000, 0.5, NaN]) expect(() => rosterConfig(id, seed)).toThrow();
    const saved = freshSession(0, id);
    saved.game.opponent = { ...rosterConfig(id, 1), version: 99 };
    saved.game.setup.opponent = saved.game.opponent;
    saved.game.rated = false;
    saved.game.unratedReason = "beta";
    const recovered = parseSavedState(saved);
    expect(recovered).not.toBeNull();
    expect(recovered?.game.opponent).toEqual(saved.game.opponent);
    expect(recovered?.game.opponent).not.toEqual(CLASSIC);
  });
}

test("legacy beta description stays exact", () => {
  const game = freshSession(0, "old").game;
  game.unratedReason = "beta";
  expect(unratedDescription(game)).toBe("Unrated beta — this opponent predates rated Morphy.");
});
