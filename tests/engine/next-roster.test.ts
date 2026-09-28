import { expect, it } from "vitest";
import { START, fromFEN, legalMoves, sqName } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { rosterBookKey } from "../../src/engine/roster/book";
import { decideExperiment } from "../../src/engine/next/roster";
const config = experimentalRosterConfig("tal", 17);
it("keeps documented legal frequencies and never consults the Classic book", () => {
  const p = START(),
    moves = legalMoves(p),
    a = moves[0],
    b = moves[1],
    uci = (m: typeof a) => sqName(m.from) + sqName(m.to);
  const book = {
    [rosterBookKey(p)]: [
      [uci(a), 1],
      [uci(b), 3],
      ["a1a8", 100],
    ],
  };
  const choices = new Set<string>();
  for (let seed = 0; seed < 20; seed++) {
    const result = decideExperiment(p, [], { ...config, seed }, "casual", book, { now: () => 0 });
    expect(result.kind).toBe("book");
    expect(result.book).toBe(true);
    expect(result.score).toBeNull();
    expect([a, b]).toContainEqual(result.move);
    expect([1, 3]).toContain(result.sourceCount);
    expect(decideExperiment(p, [], { ...config, seed }, "casual", book, { now: () => 0 })).toEqual(
      result,
    );
    choices.add(JSON.stringify(result.move));
  }
  expect(choices.size).toBe(2);
});
it("settles a terminal board before a matching repertoire entry", () => {
  const p = fromFEN("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
  expect(
    decideExperiment(
      p,
      [],
      config,
      "casual",
      { [rosterBookKey(p)]: [["h8g7", 1]] },
      { now: () => 0 },
    ),
  ).toMatchObject({ kind: "terminal", move: null, book: false });
});
it("returns explicit incompletion on an expired turn even when book moves exist", () => {
  const p = START();
  expect(
    decideExperiment(
      p,
      [],
      config,
      "casual",
      { [rosterBookKey(p)]: [["e2e4", 1]] },
      { now: () => 0, remainingMs: 0 },
    ),
  ).toMatchObject({ kind: "incomplete", move: null, book: false });
});
it.each(["tal", "fischer"] as const)("selects only exact safe candidates for offbook %s", (id) => {
  const p = fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1");
  const result = decideExperiment(
    p,
    [],
    experimentalRosterConfig(id, 17),
    "club",
    {},
    { now: () => 0, maxNodes: 10000 },
  );
  expect(result.kind).toBe("move");
  expect(result.search?.kind).toBe("completed");
  expect(result.neutralLoss).toBeLessThanOrEqual(id === "tal" ? 100 : 50);
  expect(
    result.search?.candidates.find((c) => JSON.stringify(c.move) === JSON.stringify(result.move)),
  ).toMatchObject({ kind: "exact", score: result.score });
});
it("discards an interrupted personality ranking and returns the complete neutral best", async () => {
  const { vi } = await import("vitest"),
    searchModule = await import("../../src/engine/next/shortlist-reuse-search"),
    plans = await import("../../src/engine/next/plans");
  let clock = 0,
    calls = 0;
  const originalSearch = searchModule.searchNextShortlistReuse,
    originalRank = plans.rankExperimentMove;
  const searchSpy = vi
    .spyOn(searchModule, "searchNextShortlistReuse")
    .mockImplementation((...args) => {
      const value = originalSearch(...args);
      if (++calls === 2) clock = 595;
      return value;
    });
  const rankSpy = vi.spyOn(plans, "rankExperimentMove").mockImplementation((...args) => {
    const value = originalRank(...args);
    clock = 601;
    return value;
  });
  try {
    const p = fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1");
    const result = decideExperiment(
      p,
      [],
      config,
      "club",
      {},
      { now: () => clock, maxNodes: 10000 },
    );
    expect(rankSpy).toHaveBeenCalled();
    expect(result.kind).toBe("move");
    expect(result.plan).toBeNull();
    expect(result.neutralLoss).toBe(0);
    expect(result.move).toEqual(result.search!.move);
    expect(result.score).toBe(result.search!.score);
  } finally {
    searchSpy.mockRestore();
    rankSpy.mockRestore();
  }
});
