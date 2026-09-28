import { expect, it } from "vitest";
import { fromFEN } from "../../src/engine/board";
import { searchNext } from "../../src/engine/next/search";
import { searchNextShortlist } from "../../src/engine/next/shortlist-search";
import { searchNextShortlistReuse } from "../../src/engine/next/shortlist-reuse-search";

for (const searchShortlist of [searchNextShortlist, searchNextShortlistReuse]) {
  for (const fen of ["4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1", "4k3/8/8/4q3/3P4/2P5/8/4K3 b - - 0 1"])
    for (const window of [0, 100, 300]) {
      it(`preserves exact best and certifies every exclusion at window${window}: ${fen}`, () => {
        const position = fromFEN(fen),
          sign = position.turn === "w" ? 1 : -1;
        const options = { maxDepth: 3, ms: 1000, now: () => 0 };
        const reference = searchNext(position, [], options);
        const candidate = searchShortlist(position, [], {
          ...options,
          candidateWindowCp: window,
        });
        expect(reference).toMatchObject({
          kind: "completed",
          phase: "forcing",
          depth: 3,
          interruption: null,
        });
        expect(candidate).toMatchObject({
          kind: "completed",
          phase: "forcing",
          depth: 3,
          interruption: null,
        });
        expect(candidate.score).toBe(reference.score);
        expect(candidate.candidates).toHaveLength(reference.candidates.length);
        expect(candidate.candidates.some((entry) => entry.kind !== "exact")).toBe(true);
        for (const entry of candidate.candidates) {
          const exact = reference.candidates.find(
            (value) => JSON.stringify(value.move) === JSON.stringify(entry.move),
          )!;
          expect(exact).toBeDefined();
          if (entry.kind === "exact") expect(entry.score).toBe(exact.score);
          else {
            expect(entry.kind).toBe(sign === 1 ? "upper-bound" : "lower-bound");
            expect(exact.score * sign).toBeLessThanOrEqual(entry.score * sign);
            expect(entry.score * sign).toBeLessThan(candidate.score! * sign - window);
          }
          // Equality at the final threshold is inside the inclusive exact shortlist.
          if (exact.score * sign >= reference.score! * sign - window)
            expect(entry.kind).toBe("exact");
        }
        expect(
          candidate.candidates.find(
            (entry) => JSON.stringify(entry.move) === JSON.stringify(candidate.move),
          ),
        ).toMatchObject({ kind: "exact", score: reference.score });
      });
    }
  it.each(["7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", "8/8/8/8/8/6k1/5q2/7K b - - 0 1"])(
    "keeps multiple mate ties exact at the zero-window threshold: %s",
    (fen) => {
      const p = fromFEN(fen),
        options = { maxDepth: 2, ms: 1000, now: () => 0 };
      const reference = searchNext(p, [], options);
      const result = searchShortlist(p, [], { ...options, candidateWindowCp: 0 });
      expect(result).toMatchObject({ phase: "forcing", depth: 2, interruption: null });
      const ties = reference.candidates.filter((entry) => entry.score === reference.score);
      expect(ties.length).toBeGreaterThan(1);
      expect(Math.abs(reference.score!)).toBeGreaterThan(90000);
      for (const tie of ties)
        expect(
          result.candidates.find(
            (entry) => JSON.stringify(entry.move) === JSON.stringify(tie.move),
          ),
        ).toMatchObject({ kind: "exact", score: tie.score });
    },
  );
  it("retains the entire exact baseline when shortlist refinement is interrupted", () => {
    const p = fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1");
    const options = { maxDepth: 3, ms: 1000, now: () => 0 };
    const baseline = searchNext(p, [], { ...options, baselineOnly: true });
    const result = searchShortlist(p, [], { ...options, maxNodes: baseline.nodes + 1 });
    expect(result).toMatchObject({
      kind: "completed",
      phase: "baseline",
      depth: 2,
      interruption: "nodes",
    });
    expect(result.candidates).toEqual(baseline.candidates);
    expect(result.move).toEqual(baseline.move);
  });
  it.each([-1, 301, 0.5, NaN])("rejects an invalid candidate window %s", (candidateWindowCp) => {
    expect(() =>
      searchShortlist(fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1"), [], {
        maxDepth: 2,
        ms: 1000,
        candidateWindowCp,
      }),
    ).toThrow("Invalid next-search");
  });
}
