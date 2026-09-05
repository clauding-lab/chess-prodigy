import { describe, expect, it } from "vitest";
import { START, applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { annotateAll, type AnnotatableEntry } from "../../src/coach/annotate";

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

describe("coach annotations", () => {
  it("marks a 300-point White drop as a blunder", () => {
    const annotated = annotateAll({
      hist: [entry()],
      evals: { 0: { score: 100, best: null }, 1: { score: -200, best: null } },
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
        evals: { 1: { score: -200, best: null }, 2: { score: 100, best: null } },
      }).hist[1].ann,
    ).toBe("??");
  });

  it("marks book moves and leaves missing evaluations untouched", () => {
    expect(
      annotateAll({
        hist: [entry(true)],
        evals: { 0: { score: 0, best: null }, 1: { score: 0, best: null } },
      }).hist[0].ann,
    ).toBe("book");
    const game = { hist: [entry()], evals: {} };
    expect(annotateAll(game)).toBe(game);
  });

  it("does not grade terminal mate scores as ordinary evaluation loss", () => {
    expect(
      annotateAll({
        hist: [entry()],
        evals: { 0: { score: 99999, best: null }, 1: { score: 0, best: null } },
      }).hist[0].ann,
    ).toBe("");
  });
});
