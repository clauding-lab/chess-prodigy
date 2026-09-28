import { expect, it } from "vitest";
import {
  tacticalFlags,
  sharedTacticalFailure,
  clusteredFailureInterval,
} from "../../scripts/engine-bench/tactical-protocol";
it("pins score-loss and mate-band boundaries without counting mate-distance changes", () => {
  expect(tacticalFlags(199, 0)).toEqual([]);
  expect(tacticalFlags(200, 0)).toEqual(["material-loss"]);
  expect(tacticalFlags(89999, 89999)).toEqual([]);
  expect(tacticalFlags(90000, 89999)).toEqual(["missed-win"]);
  expect(tacticalFlags(-89999, -90000)).toEqual(["avoidable-loss"]);
  expect(tacticalFlags(99999, 99995)).toEqual([]);
  expect(tacticalFlags(-99995, -99999)).toEqual([]);
  expect(tacticalFlags(90000, -90000)).toEqual(["avoidable-loss", "missed-win"]);
});
it("requires agreement on a category at both depths and counts overlaps once", () => {
  expect(sharedTacticalFailure([90000, -90000], [90000, -90000])).toBe(true);
  expect(sharedTacticalFailure([0, -90000], [90000, 0])).toBe(false);
  expect(sharedTacticalFailure([200, 0], [199, 0])).toBe(false);
  expect(sharedTacticalFailure([200, 0], [201, 0])).toBe(true);
  expect(() => tacticalFlags(NaN, 0)).toThrow();
  expect(() => tacticalFlags(0, 1)).toThrow();
});
it("resamples whole source-game clusters and reports observed aggregate failure rates", () => {
  const evidence = [
    { gameId: "a", decisions: 2, candidateFailures: 0, baselineFailures: 2 },
    { gameId: "b", decisions: 8, candidateFailures: 4, baselineFailures: 4 },
  ];
  const interval = clusteredFailureInterval(evidence);
  expect(interval).toMatchObject({
    games: 2,
    decisions: 10,
    candidateRate: 0.4,
    baselineRate: 0.6,
  });
  expect(interval.difference).toBeCloseTo(-0.2);
  expect(interval.lower).toBe(-1);
  expect(interval.upper).toBe(0);
  expect(clusteredFailureInterval(evidence)).toEqual(interval);
});
it("rejects empty, sparse, duplicate or impossible cluster evidence", () => {
  const valid = { gameId: "a", decisions: 2, candidateFailures: 0, baselineFailures: 1 };
  for (const input of [
    [],
    new Array(2),
    [valid, valid],
    [{ ...valid, decisions: 0 }],
    [{ ...valid, candidateFailures: 3 }],
    [{ ...valid, baselineFailures: -1 }],
    [
      { ...valid, decisions: Number.MAX_SAFE_INTEGER - 1 },
      { ...valid, gameId: "b", decisions: 1 },
    ],
  ])
    expect(() => clusteredFailureInterval(input)).toThrow();
});
