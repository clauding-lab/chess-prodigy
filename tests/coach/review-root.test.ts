import { expect, it } from "vitest";
import { START, applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { reviewPosition } from "../../src/engine/reviewer";
import { annotateAll } from "../../src/coach/annotate";

it("grades the best root move without subtracting an unrelated after-position score", () => {
  const before = START();
  const result = reviewPosition(before, [], undefined, () => 0);
  const mv = result.move!;
  const entry = {
    before,
    mv,
    san: sanFor(before, mv, applyMove(before, mv)),
    motifs: [],
    book: false,
    ann: null,
    better: null,
  };
  const evaluated = { score: result.score, best: mv, review: result.review };
  expect(annotateAll({ hist: [entry], evals: { 0: evaluated } }).hist[0].ann).toBe("");
  expect(result.review).toMatchObject({ perspective: "white", completion: "complete" });
  expect(result.review).toHaveProperty(
    "alternatives",
    expect.arrayContaining(legalMoves(before).map((move) => expect.objectContaining({ move }))),
  );
});

it("rejects old, incomplete, missing, duplicate, illegal and non-finite comparisons", async () => {
  const { isNeutralEvaluation } = await import("../../src/engine/reviewer");
  const position = START();
  const result = reviewPosition(position, [], undefined, () => 0);
  const value = { score: result.score, best: result.move, review: result.review };
  const first = result.review.alternatives[0];
  for (const patch of [
    { reviewer: "custom-neutral-v1" },
    { policy: "review-v1" },
    { perspective: "black" },
    { completion: "incomplete" },
    { depth: 0 },
    { alternatives: [] },
    { alternatives: result.review.alternatives.slice(1) },
    { alternatives: result.review.alternatives.map(() => first) },
    { alternatives: [null, ...result.review.alternatives.slice(1)] },
    { alternatives: [{ ...first, score: Infinity }, ...result.review.alternatives.slice(1)] },
    {
      alternatives: [
        { move: { from: 0, to: 63 }, score: 0 },
        ...result.review.alternatives.slice(1),
      ],
    },
  ])
    expect(
      isNeutralEvaluation(
        { ...value, review: { ...result.review, ...patch } } as typeof value,
        position,
        [],
      ),
    ).toBe(false);
});

it("does not grade a review interrupted before any complete root iteration", () => {
  let time = 0;
  const position = START();
  const result = reviewPosition(position, [], undefined, () => (time += 1000));
  expect(result.review.completion).toBe("incomplete");
  const mv = legalMoves(position)[0];
  expect(
    annotateAll({
      hist: [{ before: position, mv, san: "a3", motifs: [], book: false, ann: "??", better: "e4" }],
      evals: { 0: { score: result.score, best: result.move, review: result.review } },
    }).hist[0].ann,
  ).toBeNull();
});

it("removes odd-depth opening artifacts without exempting a poor book continuation", async () => {
  const { search } = await import("../../src/engine/search");
  const { sameMove, toFEN } = await import("../../src/engine/board");
  const { bookLookup } = await import("../../src/book/book");
  let position = START();
  const history: string[] = [],
    hist = [] as Parameters<typeof annotateAll>[0]["hist"];
  const sans: string[] = [];
  const observations: { san: string; oldLoss: number; rootLoss: number; ann: string | null }[] = [];
  for (const san of ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]) {
    const mv = legalMoves(position).find(
      (m) => sanFor(position, m, applyMove(position, m)) === san,
    )!;
    const after = applyMove(position, mv),
      sign = position.turn === "w" ? 1 : -1;
    const r = reviewPosition(position, history, undefined, () => 0);
    const oldLoss =
      sign * (search(position, 3, 180, () => 0).score - search(after, 3, 180, () => 0).score);
    const rootLoss =
      sign * (r.score - r.review.alternatives.find((a) => sameMove(a.move, mv))!.score);
    expect(bookLookup(sans).replies).toContain(san);
    hist.push({ before: position, mv, san, motifs: [], book: true, ann: null, better: null });
    const annotated = annotateAll({
      hist,
      evals: { [hist.length - 1]: { score: r.score, best: r.move, review: r.review } },
    });
    observations.push({ san, oldLoss, rootLoss, ann: annotated.hist.at(-1)!.ann });
    history.push(toFEN(position));
    sans.push(san);
    position = after;
  }
  expect(observations.slice(0, 5).map((o) => o.ann)).toEqual(["", "", "", "", ""]);
  expect(observations[2]).toMatchObject({ san: "Nf3", oldLoss: 50, rootLoss: 0 });
  // This shallow reviewer may criticize theory: provenance never certifies quality.
  expect(observations[5]).toMatchObject({ san: "a6", rootLoss: 140, ann: "?" });
});

it.each([{ castle: "Q" as const }, { ep: true }, { capture: "bq" as const }, { double: true }])(
  "rejects forged move attributes in comparisons and hints: %j",
  async (patch) => {
    const { isNeutralEvaluation } = await import("../../src/engine/reviewer");
    const before = START();
    const result = reviewPosition(before, [], undefined, () => 0);
    const index = result.review.alternatives.findIndex(
      (a) => a.move.from === 57 && a.move.to === 42,
    );
    const canonical = result.review.alternatives[index].move;
    const forged = { ...canonical, ...patch };
    const value = {
      score: result.score,
      best: result.move,
      review: {
        ...result.review,
        alternatives: result.review.alternatives.map((a, i) =>
          i === index ? { move: forged, score: 2000 } : a,
        ),
      },
    };
    const mv = legalMoves(before).find((m) => m.from === 52 && m.to === 36)!;
    const entry = { before, mv, san: "e4", motifs: [], book: false, ann: "??", better: "O-O-O" };
    expect(annotateAll({ hist: [entry], evals: { 0: value } }).hist[0]).toMatchObject({
      ann: null,
      better: null,
    });
    expect(isNeutralEvaluation(value, before, [])).toBe(false);
    expect(
      isNeutralEvaluation({ score: result.score, best: forged, review: result.review }, before, []),
    ).toBe(false);
  },
);

it.each([
  ["4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "O-O"],
  ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6"],
])("accepts canonical special-move attributes: %s", async (fen, san) => {
  const { fromFEN } = await import("../../src/engine/board");
  const { isNeutralEvaluation } = await import("../../src/engine/reviewer");
  const position = fromFEN(fen);
  const r = reviewPosition(position, [], undefined, () => 0);
  const move = r.review.alternatives.find(
    (a) => sanFor(position, a.move, applyMove(position, a.move)) === san,
  )!.move;
  expect(isNeutralEvaluation({ score: r.score, best: move, review: r.review }, position, [])).toBe(
    true,
  );
});
