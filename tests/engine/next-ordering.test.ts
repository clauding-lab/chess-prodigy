import { expect, it } from "vitest";
import { fromFEN } from "../../src/engine/board";
import { searchNext } from "../../src/engine/next/search";
import { searchNextOrdered } from "../../src/engine/next/ordered-search";

const positions = [
  "4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1",
  "4k3/8/8/4q3/3P4/2P5/8/4K3 b - - 0 1",
  "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
  "8/8/8/8/8/6k1/5q2/7K b - - 0 1",
];
it.each(positions)("ordering preserves every exact completed candidate score: %s", (fen) => {
  const position = fromFEN(fen);
  const options = { maxDepth: 3, ms: 1000, now: () => 0 };
  const reference = searchNext(position, [], options);
  const candidate = searchNextOrdered(position, [], options);
  const scores = (result: typeof reference | typeof candidate) =>
    result.candidates
      .map(({ move, score, depth }) => ({ key: JSON.stringify(move), score, depth }))
      .sort((a, b) => a.key.localeCompare(b.key));
  expect(reference).toMatchObject({
    kind: "completed",
    depth: 3,
    phase: "forcing",
    interruption: null,
  });
  expect(candidate).toMatchObject({
    kind: "completed",
    depth: 3,
    phase: "forcing",
    interruption: null,
  });
  expect(scores(candidate)).toEqual(scores(reference));
  expect(candidate.policy).not.toBe(reference.policy);
});
it("does not invent a move when its complete baseline is interrupted", () => {
  const result = searchNextOrdered(fromFEN(positions[0]), [], {
    maxDepth: 3,
    ms: 1000,
    now: () => 0,
    maxNodes: 2,
  });
  expect(result).toMatchObject({
    kind: "incomplete",
    move: null,
    score: null,
    candidates: [],
    interruption: "nodes",
  });
});
