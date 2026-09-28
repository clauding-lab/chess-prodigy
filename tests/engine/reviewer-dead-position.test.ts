import { expect, it } from "vitest";
import { applyMove, fromFEN, legalMoves, sameMove, sanFor, toFEN } from "../../src/engine/board";
import { isNeutralEvaluation, reviewPosition } from "../../src/engine/reviewer";
import { searchRootCandidates } from "../../src/engine/search";
import { searchReviewCandidates } from "../../src/engine/review-search";

for (const fen of ["7k/8/8/8/5p2/4B3/8/K1B5 w - - 0 1", "5b1k/8/3b4/2P5/8/8/8/K7 b - - 0 1"])
  it(`reviews the drawing capture and terminal position consistently: ${fen}`, () => {
    const before = fromFEN(fen);
    const capture = legalMoves(before).find((move) =>
      sanFor(before, move, applyMove(before, move)).startsWith("Bx"),
    )!;
    const after = applyMove(before, capture);
    for (const policy of ["review-v2", "hint-v1"] as const) {
      const review = reviewPosition(before, [], policy, () => 0);
      expect(review.review.depth).toBeGreaterThan(0);
      expect(review.review.alternatives.find(({ move }) => sameMove(move, capture))?.score).toBe(0);
      const terminal = reviewPosition(after, [toFEN(before)], policy, () => 0);
      expect(terminal).toMatchObject({
        move: null,
        score: 0,
        depth: 0,
        review: { reviewer: "custom-neutral-v3", completion: "complete", alternatives: [] },
      });
      const value = { best: terminal.move, score: terminal.score, review: terminal.review };
      for (const invalid of [
        { ...value, best: legalMoves(after)[0] },
        { ...value, review: { ...value.review, depth: 1 } },
        { ...value, review: { ...value.review, completion: "incomplete" as const } },
        { ...value, review: { ...value.review, alternatives: [{ move: capture, score: 0 }] } },
      ])
        expect(isNeutralEvaluation(invalid, after, [toFEN(before)], policy)).toBe(false);
      expect(isNeutralEvaluation(value, after, [toFEN(before)], policy)).toBe(true);
      expect(isNeutralEvaluation({ ...value, score: 650 }, after, [toFEN(before)], policy)).toBe(
        false,
      );
      expect(
        isNeutralEvaluation(
          { ...value, review: { ...value.review, reviewer: "custom-neutral-v2" } } as typeof value,
          after,
          [toFEN(before)],
          policy,
        ),
      ).toBe(false);
    }
    // The prior playing policy is deliberately frozen; only neutral coaching changes.
    expect(searchRootCandidates(after, 1, 180, () => 0).fallback.move).not.toBeNull();
  });

it.each([
  ["7k/8/6P1/8/8/4B3/8/K1B5 w - - 0 1", "g7+"],
  ["k1b5/8/4b3/8/8/6p1/8/7K b - - 0 1", "g2+"],
])("recognizes the draw inside a forcing continuation: %s", (fen, san) => {
  const position = fromFEN(fen);
  const result = searchReviewCandidates(position, 1, 180, () => 0);
  expect(result).toMatchObject({ depth: 1, timedOut: false });
  const candidate = result.candidates.find(
    ({ move }) => sanFor(position, move, applyMove(position, move)) === san,
  );
  expect(candidate).toBeDefined();
  expect(Math.abs(candidate!.score)).toBe(0);
});

it.each([
  ["7k/6Q1/6K1/8/8/8/8/8 b - - 100 1", 100_000],
  ["8/8/8/8/8/6k1/6q1/7K w - - 100 1", -100_000],
] as const)("preserves checkmate precedence over the fifty-move draw: %s", (fen, score) => {
  const position = fromFEN(fen);
  const result = reviewPosition(position, [], "review-v2", () => 0);
  expect(result).toMatchObject({ move: null, score, depth: 0 });
  const value = { best: result.move, score: result.score, review: result.review };
  expect(isNeutralEvaluation(value, position, [])).toBe(true);
  expect(isNeutralEvaluation({ ...value, score: 0 }, position, [])).toBe(false);
});
