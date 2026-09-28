import { describe, expect, it } from "vitest";
import { pairedInterval, strengthSchedule } from "../../scripts/engine-bench/strength-core";

describe("prospective complete-pair strength evidence", () => {
  it("freezes both colours and separate candidate/baseline seeds for all development levels", () => {
    const rows = strengthSchedule("development", "tal", "club", "tal");
    expect(rows).toHaveLength(40);
    expect(new Set(rows.map((row) => row.key)).size).toBe(40);
    for (let pair = 0; pair < 20; pair++) {
      const [white, black] = rows.slice(pair * 2, pair * 2 + 2);
      expect(white).toMatchObject({
        pair,
        color: "w",
        candidate: "tal",
        baseline: "tal",
        level: "club",
      });
      expect(black).toMatchObject({
        pair,
        color: "b",
        seed: white.seed,
        baselineSeed: white.baselineSeed,
      });
      expect(white.seed).not.toBe(white.baselineSeed);
    }
    expect(strengthSchedule("development", "tal", "club", "tal")).toEqual(rows);
  });
  it("resamples whole pairs rather than pretending two colour legs are independent", () => {
    expect(pairedInterval(Array.from({ length: 20 }, () => [1, 0] as const))).toEqual({
      mean: 0.5,
      lower: 0.5,
      upper: 0.5,
      pairs: 20,
    });
    expect(pairedInterval(Array.from({ length: 20 }, () => [1, 1] as const))).toEqual({
      mean: 1,
      lower: 1,
      upper: 1,
      pairs: 20,
    });
    const pairs = [
      [0, 0],
      [1, 1],
      [0.5, 0.5],
      [1, 0],
    ] as const;
    expect(pairedInterval(pairs)).toEqual(pairedInterval(pairs));
    expect(pairedInterval(pairs).mean).toBe(0.5);
    expect(pairedInterval(pairs).lower).toBeLessThan(0.5);
    expect(pairedInterval(pairs).upper).toBeGreaterThan(0.5);
  });
  it("rejects missing legs, empty evidence and invalid outcomes", () => {
    for (const invalid of [
      [],
      new Array(20),
      [[1]],
      [[1, null]],
      [[0, 0, 0]],
      [[NaN, 0]],
      [[0.3, 1]],
    ])
      expect(() => pairedInterval(invalid as never)).toThrow();
  });
  it("does not generate validation games before method review and candidate freeze", () => {
    expect(() => strengthSchedule("validation" as never, "tal", "strong", "tal")).toThrow();
    expect(() => strengthSchedule("development", "tal", "club", "fischer")).toThrow();
  });
});
