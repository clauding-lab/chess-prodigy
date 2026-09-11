import { describe, expect, it } from "vitest";
import { START, applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { annotateAll, type AnnotatableEntry } from "../../src/coach/annotate";
import { reviewPosition, reviewHistory } from "../../src/engine/reviewer";

function entry(book = false): AnnotatableEntry {
  const before = START();
  const mv = legalMoves(before).find((move) => move.from === 52 && move.to === 36)!;
  return {
    san: sanFor(before, mv, applyMove(before, mv)),
    mv,
    before,
    motifs: [],
    book,
    ann: null,
    better: null,
  };
}

function evaluations(hist: AnnotatableEntry[], scores: Record<number, number>) {
  return Object.fromEntries(
    Object.entries(scores).map(([key, score]) => {
      const ply = Number(key);
      const at = hist[ply]?.before ?? applyMove(hist.at(-1)!.before, hist.at(-1)!.mv);
      const result = reviewPosition(at, reviewHistory({ hist }, ply), "review-v1", () => 0);
      return [key, { score, best: result.move, review: result.review }];
    }),
  );
}

describe("coach annotations", () => {
  it("marks a 300-point White drop as a blunder", () => {
    const annotated = annotateAll({
      hist: [entry()],
      evals: evaluations([entry()], { 0: 100, 1: -200 }),
    });
    expect(annotated.hist[0].ann).toBe("??");
  });

  it("inverts evaluation scores for a Black move", () => {
    const white = entry();
    const afterWhite = applyMove(white.before, white.mv);
    const blackMove = legalMoves(afterWhite)[0];
    const black: AnnotatableEntry = {
      san: sanFor(afterWhite, blackMove, applyMove(afterWhite, blackMove)),
      mv: blackMove,
      before: afterWhite,
      motifs: [],
      book: false,
      ann: null,
      better: null,
    };
    expect(
      annotateAll({
        hist: [white, black],
        evals: evaluations([white, black], { 1: -200, 2: 100 }),
      }).hist[1].ann,
    ).toBe("??");
  });

  it("marks book moves and leaves missing evaluations untouched", () => {
    expect(
      annotateAll({
        hist: [entry(true)],
        evals: evaluations([entry(true)], { 0: 0, 1: 0 }),
      }).hist[0].ann,
    ).toBe("book");
    const game = { hist: [entry()], evals: {} };
    expect(annotateAll(game)).toBe(game);
  });

  it("does not grade terminal mate scores as ordinary evaluation loss", () => {
    expect(
      annotateAll({
        hist: [entry()],
        evals: evaluations([entry()], { 0: 99999, 1: 0 }),
      }).hist[0].ann,
    ).toBe("");
  });
});

it("does not turn provenance-free opponent scores into a neutral verdict", () => {
  const game = annotateAll({
    hist: [{ ...entry(), ann: "??", better: "d4" }],
    evals: { 0: { score: 100, best: null }, 1: { score: -900, best: null } },
  });
  expect(game.hist[0].ann).toBeNull();
  expect(game.hist[0].better).toBeNull();
});
