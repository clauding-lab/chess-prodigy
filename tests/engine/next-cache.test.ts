import { expect, it } from "vitest";
import { fromFEN, toFEN } from "../../src/engine/board";
import { searchNext } from "../../src/engine/next/search";
import { searchNextCached } from "../../src/engine/next/cached-search";

it("evicts bounded cache entries without changing an interrupted search's retained comparison", () => {
  const position = fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const options = { maxDepth: 4, ms: 1000, now: () => 0, maxNodes: 8000 };
  const reference = searchNext(position, [], options);
  const cached = searchNextCached(position, [], options);
  expect(cached.cache.misses).toBeGreaterThan(2048);
  expect(cached.cache.entries).toBe(2048);
  expect(cached.interruption).toBe("nodes");
  expect(cached.nodes).toBe(reference.nodes);
  expect(cached.candidates).toEqual(reference.candidates);
  expect(cached.move).toEqual(reference.move);
});

it.each([
  "4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1",
  "4k3/8/8/4q3/3P4/2P5/8/4K3 b - - 0 1",
  "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
])("legal-move caching preserves exact search and node accounting: %s", (fen) => {
  const position = fromFEN(fen);
  const options = { maxDepth: 3, ms: 1000, now: () => 0 };
  const reference = searchNext(position, [], options);
  const cached = searchNextCached(position, [], options);
  expect(reference).toMatchObject({
    kind: "completed",
    depth: 3,
    phase: "forcing",
    interruption: null,
  });
  expect(cached).toMatchObject({
    kind: "completed",
    depth: 3,
    phase: "forcing",
    interruption: null,
  });
  expect(cached.candidates).toEqual(reference.candidates);
  expect(cached.move).toEqual(reference.move);
  expect(cached.nodes).toBe(reference.nodes);
  expect(cached.cache.hits).toBeGreaterThan(0);
  expect(cached.cache.entries).toBeLessThanOrEqual(2048);
});
it("never reuses draw results or a previous request's cache", () => {
  const position = fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1");
  const options = { maxDepth: 2, ms: 1000, now: () => 0 };
  const draw = searchNextCached(position, [toFEN(position), toFEN(position)], options);
  expect(draw).toMatchObject({ kind: "terminal", terminal: "threefold-repetition", score: 0 });
  const fresh = searchNextCached(position, [], options);
  expect(fresh.kind).toBe("completed");
  expect(fresh.candidates).toEqual(searchNext(position, [], options).candidates);
  expect(searchNextCached(position, [], { ...options, maxNodes: 0 })).toMatchObject({
    kind: "incomplete",
    move: null,
    cache: { hits: 0 },
  });
});
