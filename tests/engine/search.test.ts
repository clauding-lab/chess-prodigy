import { describe, expect, it } from "vitest";
import { START, applyMove, fromFEN, sanFor } from "../../src/engine/board";
import { MATE, quiesce, search } from "../../src/engine/search";

describe("search", () => {
  it("finds mate in one", () => {
    const position = fromFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
    const result = search(position, 4, 150);
    expect(result.move).not.toBeNull();
    expect(sanFor(position, result.move!, applyMove(position, result.move!))).toMatch(/#$/);
  });
  it("respects a 100 ms budget with tolerance", () => {
    const started = performance.now();
    search(START(), 10, 100);
    expect(performance.now() - started).toBeLessThan(250);
  });
  it("recognises mate in quiescence", () =>
    expect(quiesce(fromFEN("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1"), -Infinity, Infinity, 4)).toBeLessThan(
      -MATE + 1000,
    ));
  it("searches quiet check evasions", () =>
    expect(quiesce(fromFEN("5n2/7Q/8/8/8/1bk5/r7/K7 w - - 0 1"), -Infinity, -500, 4)).toBeLessThan(
      -500,
    ));

  it("does not leak a timed-out request into the next search", () => {
    let tick = 0;
    const timedOut = search(START(), 5, 1, () => tick++);
    expect(timedOut.move).not.toBeNull();
    const next = search(fromFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1"), 4, 150);
    expect(next.move).not.toBeNull();
  });
});

it("returns a terminal draw at the root even when a capture could reset the halfmove counter", () => {
  const position = fromFEN("7k/p7/8/8/8/8/8/QK6 w - - 100 80");
  expect(search(position, 2, 100)).toEqual({ move: null, score: 0, depth: 0 });
  expect(search(fromFEN("7k/8/8/8/8/8/8/K7 w - - 0 1"), 2, 100)).toEqual({
    move: null,
    score: 0,
    depth: 0,
  });
});
