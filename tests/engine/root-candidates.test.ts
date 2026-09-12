import { expect, test } from "vitest";
import { applyMove, fromFEN, legalMoves, sameMove, START } from "../../src/engine/board";
import * as engine from "../../src/engine/search";

// Catches publishing partial/mixed-depth roots or shared-window bound scores.
test("publishes every legal root with a full-window score at one completed depth", () => {
  expect(engine.searchRootCandidates).toBeTypeOf("function");
  const p = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
  const result = engine.searchRootCandidates(p, 2, 1000, () => 0);
  expect(result.depth).toBe(2);
  expect(result.candidates).toHaveLength(legalMoves(p).length);
  expect(
    new Set(result.candidates.map((c) => `${c.move.from}:${c.move.to}:${c.move.promo}`)).size,
  ).toBe(legalMoves(p).length);
  for (const candidate of result.candidates) {
    expect(legalMoves(p).some((m) => sameMove(m, candidate.move))).toBe(true);
    expect(candidate.score).toBe(
      engine.search(applyMove(p, candidate.move), 1, 1000, () => 0).score,
    );
  }
  expect(result.fallback.move?.capture).toBe("bq");
});

test("zero budget and interrupted first iteration expose no rankable alternatives", () => {
  for (const allowance of [0, 7]) {
    let ticks = 0;
    const result = engine.searchRootCandidates(START(), 2, allowance, () => ticks++);
    expect(result.candidates).toEqual([]);
    expect(result.depth).toBe(0);
    expect(result.timedOut).toBe(true);
    expect(legalMoves(START())).toContainEqual(result.fallback.move);
  }
});

test("interrupted next iteration retains the entire previous completed iteration", () => {
  let calls = 0;
  const first = engine.searchRootCandidates(START(), 1, 100000, () => {
    calls++;
    return 0;
  });
  let tick = 0;
  const interrupted = engine.searchRootCandidates(START(), 3, 100, () =>
    ++tick > calls + 8 ? 100 : 0,
  );
  expect(interrupted.depth).toBe(1);
  expect(interrupted.candidates).toEqual(first.candidates);
  expect(interrupted.fallback).toEqual(first.fallback);
  expect(interrupted.timedOut).toBe(true);
});

test("terminal roots return no moves or style candidates", () => {
  for (const p of [fromFEN("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"), { ...START(), halfmove: 100 }]) {
    const r = engine.searchRootCandidates(p, 2, 100, () => 0);
    expect(r.fallback.move).toBeNull();
    expect(r.candidates).toEqual([]);
  }
});

test("an already expired common deadline cannot be extended by late search setup", () => {
  const result = engine.searchRootCandidates(START(), 1, 100, () => 200, 100);
  expect(result.depth).toBe(0);
  expect(result.candidates).toEqual([]);
  expect(result.timedOut).toBe(true);
});
