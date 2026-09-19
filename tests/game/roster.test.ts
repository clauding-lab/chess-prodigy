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

const ACCEPTED_RATINGS = {
  spassky: { casual: 1150, club: 1325, strong: 1700 },
  tal: { casual: 1200, club: 1325, strong: 1700 },
  fischer: { casual: 1250, club: 1350, strong: 1675 },
} as const;

for (const id of ROSTER_IDS) {
  test(`${id} has an accepted exact rating and settles one reversible receipt`, () => {
    const config = rosterConfig(id, 0xffffffff);
    expect(isOpponentConfig(config)).toBe(true);
    expect(isSupportedOpponent(config)).toBe(true);
    expect(opponentName(config)).not.toContain("Unavailable");
    expect(ROSTER_RATINGS[id]).toEqual(ACCEPTED_RATINGS[id]);
    expect(isRatedOpponent(config)).toBe(true);
    for (const level of ["casual", "club", "strong"] as const) {
      expect(opponentPracticeRating(config, level)).toBe(ACCEPTED_RATINGS[id][level]);
      const before = freshSession(0, "before");
      before.rating = { ...before.rating, rating: 1600, peak: 1600 };
      expect(parseSavedState(before)).toEqual(before);
      const game = reduceSession(before, {
        type: "new",
        id,
        now: 0,
        setup: { playerColor: "w", level, time: "none", opponent: config },
      });
      expect(game.game.rated).toBe(true);
      expect(game.game.unratedReason).toBeNull();
      expect(parseSavedState(game)?.game.opponent).toEqual(config);
      const moved = reduceSession(game, {
        type: "move",
        move: legalMoves(game.game.st)[0],
        book: false,
        now: 1,
      });
      const end = reduceSession(moved, { type: "resign", now: 2 });
      const difference = Math.max(-400, Math.min(400, ACCEPTED_RATINGS[id][level] - 1600));
      const expectedAfter = 1600 - 40 / (1 + 10 ** (difference / 400));
      expect(end.rating.rating).toBeCloseTo(expectedAfter, 10);
      expect(end.game.ratingApplied?.delta).toBeCloseTo(expectedAfter - 1600, 10);
      expect(end.game.ratingApplied!.delta).toBeLessThan(0);
      expect(end.rating.games).toBe(1);
      expect(end.rating.history.at(-1)).toMatchObject({
        opp: `${opponentName(config)} · ${level[0].toUpperCase()}${level.slice(1)}`,
        oppRating: ACCEPTED_RATINGS[id][level],
        score: 0,
      });
      expect(end.game.ratingApplied).toMatchObject({ gameId: end.game.id, before: game.rating });
      expect(parseGameRecord(updateArchive([], end)[0])?.opponent).toEqual(config);
      const undone = reduceSession(end, { type: "undo", now: 3 });
      expect(undone.rating).toEqual(game.rating);
      expect(undone.game.ratingApplied).toBeNull();
      expect(undone.game.unratedReason).toBe("takeback");
      expect(parseSavedState(end)?.game.ratingApplied).toEqual(end.game.ratingApplied);
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

for (const id of ROSTER_IDS)
  test(`stored ${id} beta game remains recoverable and unrated after activation`, () => {
    const original = reduceSession(freshSession(0, `legacy-${id}`), {
      type: "new",
      id: `legacy-${id}`,
      now: 0,
      setup: {
        playerColor: "w",
        level: "club",
        time: "none",
        opponent: rosterConfig(id, 7),
      },
    });
    const beta = {
      ...original,
      rating: { ...original.rating, rating: 1450, peak: 1450 },
      game: {
        ...original.game,
        rated: false,
        unratedReason: "beta" as const,
        ratingApplied: null,
      },
    };
    const recovered = parseSavedState(beta);
    expect(recovered).toEqual(beta);
    expect(unratedDescription(recovered!.game)).toBe(
      "Unrated beta — this game keeps its original unrated status.",
    );
    const moved = reduceSession(recovered!, {
      type: "move",
      move: legalMoves(recovered!.game.st)[0],
      book: false,
      now: 1,
    });
    const completed = reduceSession(moved, { type: "resign", now: 2 });
    expect(completed.rating).toEqual(beta.rating);
    expect(completed.game.ratingApplied).toBeNull();
    expect(completed.game.unratedReason).toBe("beta");
    expect(
      parseSavedState({
        ...beta,
        game: {
          ...beta.game,
          ratingApplied: {
            gameId: beta.game.id,
            before: beta.rating,
            after: beta.rating,
            delta: 0,
          },
        },
      }),
    ).toBeNull();
  });
