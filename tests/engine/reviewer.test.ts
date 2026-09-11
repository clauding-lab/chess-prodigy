import { describe, it, expect } from "vitest";
import { fromFEN, START, applyMove, legalMoves, sanFor, toFEN } from "../../src/engine/board";
import { evaluate } from "../../src/engine/eval";
import {
  REVIEWER,
  reviewPosition,
  historyIdentity,
  isNeutralEvaluation,
} from "../../src/engine/reviewer";
import { executeEngineRequest } from "../../src/worker/execute";
import { annotateAll } from "../../src/coach/annotate";
import type { AnnotatableEntry } from "../../src/coach/types";

const fixedClock = () => 0;
function entry(
  position: ReturnType<typeof START>,
  move: ReturnType<typeof legalMoves>[number],
): AnnotatableEntry {
  return {
    before: position,
    mv: move,
    san: sanFor(position, move, applyMove(position, move)),
    motifs: [],
    book: false,
    ann: null,
    better: null,
  };
}
const value = (r: ReturnType<typeof reviewPosition>) => ({
  score: r.score,
  best: r.move,
  review: r.review,
});

describe("neutral reviewer independence", () => {
  it.each([
    ["4k3/8/8/8/8/8/q7/R3K3 w - - 0 1", 57, "Rb1", "Rxa2"],
    ["r3k3/Q7/8/8/8/8/8/4K3 b - - 0 1", 1, "Rb8", "Rxa7"],
  ] as const)(
    "detects a test-only evaluator's inferior choice: %s",
    (fen, target, badSan, bestSan) => {
      const position = fromFEN(fen);
      const side = position.turn;
      // Test-only bias rewards moving the rook next to its starting square, ignoring
      // the free enemy queen. Neutral depth-3 review must show >=1000 centipawns
      // (ten pawn units) lost, in both colours. No production personality uses this.
      const biased = (next: typeof position) =>
        next.board[target] === `${side}r` ? 1000000 : evaluate(next) * (side === "w" ? 1 : -1);
      const bad = legalMoves(position).sort(
        (a, b) => biased(applyMove(position, b)) - biased(applyMove(position, a)),
      )[0];
      expect(sanFor(position, bad, applyMove(position, bad))).toBe(badSan);
      const before = reviewPosition(position, [], "review-v1", fixedClock);
      const after = reviewPosition(
        applyMove(position, bad),
        [toFEN(position)],
        "review-v1",
        fixedClock,
      );
      expect(sanFor(position, before.move!, applyMove(position, before.move!))).toBe(bestSan);
      expect((before.score - after.score) * (side === "w" ? 1 : -1)).toBeGreaterThanOrEqual(1000);
      const hist = [entry(position, bad)];
      expect(
        annotateAll({ hist, evals: { 0: value(before), 1: value(after) } }).hist[0],
      ).toMatchObject({ ann: "??", better: bestSan });
      // Opponent IDs and weights are deliberately extra test-only transport fields.
      const results = [
        { id: "classic", weight: 0 },
        { id: "test-attacker", weight: 999999 },
        { id: "test-defender", weight: -999999 },
      ].map((personality) => {
        const request = {
          type: "analyse" as const,
          reviewer: REVIEWER,
          policy: "review-v1" as const,
          history: [],
          position,
          gameId: "fixture",
          revision: 0,
          requestId: 1,
          personality,
        };
        const result = executeEngineRequest(request, fixedClock) as typeof before;
        return {
          result,
          hist: annotateAll({ hist, evals: { 0: value(result), 1: value(after) } }).hist,
        };
      });
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
    },
  );

  it("does not retain opponent work when the same worker handler reviews later", () => {
    const position = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
    const request = {
      type: "analyse" as const,
      reviewer: REVIEWER,
      policy: "review-v1" as const,
      history: [],
      position,
      gameId: "reuse",
      revision: 0,
      requestId: 2,
    };
    const expected = executeEngineRequest(request, fixedClock);
    executeEngineRequest(
      {
        type: "ai",
        level: "casual",
        bookSans: [],
        position,
        gameId: "reuse",
        revision: 0,
        requestId: 1,
      },
      fixedClock,
    );
    expect(executeEngineRequest(request, fixedClock)).toEqual(expected);
  });

  it("invalidates history, rule-state, policy, version and purpose mismatches", () => {
    const position = START();
    const r = value(reviewPosition(position, [], "review-v1", fixedClock));
    expect(isNeutralEvaluation(r, position, [])).toBe(true);
    expect(isNeutralEvaluation(r, { ...position, halfmove: 99 }, [])).toBe(false);
    expect(isNeutralEvaluation(r, position, [toFEN(position)])).toBe(false);
    expect(isNeutralEvaluation(r, position, [], "hint-v1")).toBe(false);
    for (const patch of [{ purpose: "opponent" }, { reviewer: "obsolete" }, { depth: 99 }])
      expect(
        isNeutralEvaluation({ ...r, review: { ...r.review, ...patch } } as typeof r, position, []),
      ).toBe(false);
    expect(historyIdentity(Array(500).fill(toFEN(position)))).toHaveLength(16);
  });

  it("replaces annotations and clears them for incomplete or incompatible reanalysis", () => {
    const position = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
    const move = legalMoves(position).find((m) => m.to === 57)!;
    const before = value(reviewPosition(position, [], "review-v1", fixedClock));
    const after = value(
      reviewPosition(applyMove(position, move), [toFEN(position)], "review-v1", fixedClock),
    );
    const first = annotateAll({ hist: [entry(position, move)], evals: { 0: before, 1: after } });
    expect(first.hist[0].ann).toBe("??");
    // Controlled neutral result updates isolate annotation recomputation, rather
    // than relying on non-deterministic machine load changing search depth.
    const updated = annotateAll({
      ...first,
      evals: { 0: before, 1: { ...after, score: before.score } },
    });
    expect(updated.hist[0]).toMatchObject({ ann: "", better: null });
    const incomplete = { ...after, review: { ...after.review, depth: 0 } };
    expect(annotateAll({ ...first, evals: { 0: before, 1: incomplete } }).hist[0]).toMatchObject({
      ann: null,
      better: null,
    });
    expect(annotateAll({ ...first, evals: { 0: before } }).hist[0]).toMatchObject({
      ann: null,
      better: null,
    });
  });
});
