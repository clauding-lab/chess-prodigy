import { expect, it } from "vitest";
import {
  experimentalRosterConfig,
  isExperimentalOpponent,
  isRatedOpponent,
  isSupportedOpponent,
  rosterConfig,
} from "../../src/engine/opponents";
import { opponentPracticeRating, ROSTER_RATINGS } from "../../src/rating/opponents";
it.each(["tal", "fischer"] as const)(
  "keeps %s experimental identity separate and unrated at every level",
  (id) => {
    const old = rosterConfig(id, 19),
      next = experimentalRosterConfig(id, 19);
    expect(next).toEqual({
      id,
      version: 2,
      engine: `${id}-coherent-v1`,
      randomPolicy: "seeded-per-ply-v1",
      seed: 19,
    });
    expect(isSupportedOpponent(next)).toBe(true);
    expect(isExperimentalOpponent(next)).toBe(true);
    expect(isRatedOpponent(next)).toBe(false);
    expect(isRatedOpponent(old)).toBe(true);
    for (const level of ["casual", "club", "strong"] as const) {
      expect(opponentPracticeRating(next, level)).toBeNull();
      expect(opponentPracticeRating(old, level)).toBe(ROSTER_RATINGS[id][level]);
    }
    expect(isSupportedOpponent({ ...next, engine: `${id}-plans-v1` })).toBe(false);
    expect(isSupportedOpponent({ ...next, version: 3 })).toBe(false);
    expect(isSupportedOpponent({ ...next, seed: null })).toBe(false);
  },
);
it("does not introduce a Spassky experiment or permit invalid seeds", () => {
  expect(() => experimentalRosterConfig("spassky" as never, 1)).toThrow();
  for (const seed of [-1, 0.5, 4294967296, NaN])
    expect(() => experimentalRosterConfig("tal", seed)).toThrow();
});
