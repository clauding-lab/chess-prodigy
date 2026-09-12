import { describe, expect, it } from "vitest";
import * as opponents from "../../src/engine/opponents";

describe("historical Morphy configuration", () => {
  it("supports measured version 3 separately from the rated legacy policy", () => {
    const config = {
      id: "attack-development",
      version: 3,
      engine: "historical-v1",
      randomPolicy: "seeded-per-ply-v1",
      seed: 9,
    };
    expect(opponents.isSupportedOpponent(config)).toBe(true);
    expect(opponents.isRatedOpponent(config)).toBe(true);
    expect(opponents.isSupportedOpponent({ ...config, engine: "style-v1" })).toBe(false);
  });
});

import {
  START,
  applyMove,
  fromFEN,
  inCheck,
  legalMoves,
  posKey,
  sanFor,
  sqName,
} from "../../src/engine/board";
import { chooseOpponentMove } from "../../src/engine/morphy";
import { LEVEL_CFG, MATE } from "../../src/engine/search";
import { evaluate } from "../../src/engine/eval";
import type { Move, Position } from "../../src/engine/types";
import bookData from "../../src/book/morphy-book.json";

const book = bookData as unknown as Record<string, [string, number][]>;
const uci = (move: Move | null) =>
  move ? `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}` : null;
const fixed = () => 0;

// Reflect ranks and exchange colours: all positional preferences must change sign.
function mirror(p: Position): Position {
  return {
    ...p,
    board: p.board.map((_, i) => {
      const piece = p.board[i ^ 56];
      return piece ? (`${piece[0] === "w" ? "b" : "w"}${piece[1]}` as typeof piece) : null;
    }),
    turn: p.turn === "w" ? "b" : "w",
    castling: { K: p.castling.k, Q: p.castling.q, k: p.castling.K, q: p.castling.Q },
    ep: p.ep === null ? null : p.ep ^ 56,
  };
}

describe("historical Morphy policy", () => {
  it("always chooses legal recorded counts, reproducibly, regardless of Classic replies or Casual book probability", () => {
    const p = START(),
      counts = book[posKey(p)],
      seen = new Map<string, number>();
    for (let seed = 0; seed < 500; seed++) {
      const config = opponents.historicalMorphyConfig(seed);
      const a = chooseOpponentMove(p, "casual", ["d4"], config, 0, fixed);
      const b = chooseOpponentMove(p, "casual", ["a3", "Nf3"], config, 0, fixed);
      expect(a).toEqual(b);
      expect(a.book).toBe(true);
      expect(legalMoves(p)).toContainEqual(a.move);
      expect(counts.map(([move]) => move)).toContain(uci(a.move));
      seen.set(uci(a.move)!, (seen.get(uci(a.move)!) ?? 0) + 1);
    }
    const total = counts.reduce((sum, [, count]) => sum + count, 0);
    for (const [move, count] of counts)
      expect(Math.abs((seen.get(move) ?? 0) / 500 - count / total)).toBeLessThan(0.07);
  });

  it("rejects invalid seeds and move identities", () => {
    for (const seed of [-1, 0x100000000, NaN, 1.5])
      expect(() => opponents.historicalMorphyConfig(seed)).toThrow(/seed/);
    expect(() =>
      chooseOpponentMove(START(), "club", [], opponents.historicalMorphyConfig(1), -1, fixed),
    ).toThrow(/identity/);
  });

  it("recognizes game end before book lookup and reports White-perspective mate scores", () => {
    const config = opponents.historicalMorphyConfig(3);
    for (const p of [
      { ...START(), halfmove: 100 },
      fromFEN("8/8/4k3/8/8/4K3/8/8 w - - 0 1"),
      fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
    ])
      expect(chooseOpponentMove(p, "club", [], config, 0, fixed)).toEqual({
        move: null,
        score: 0,
        book: false,
      });
    const mated = fromFEN("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
    expect(chooseOpponentMove(mated, "club", [], config, 0, fixed).score).toBe(MATE);
    expect(chooseOpponentMove(mirror(mated), "club", [], config, 0, fixed).score).toBe(-MATE);
  });

  it("uses bounded custom search off book and retains tactical safety for both colours", () => {
    const p = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1"),
      config = opponents.historicalMorphyConfig(3);
    for (const position of [p, mirror(p)]) {
      expect(book[posKey(position)]).toBeUndefined();
      const choice = chooseOpponentMove(position, "club", ["Ke2"], config, 10, fixed);
      expect(choice.book).toBe(false);
      expect(choice.move?.capture?.[1]).toBe("q");
      expect(choice.score! * (position.turn === "w" ? 1 : -1)).toBeGreaterThan(0);
      for (const level of ["casual", "club", "strong"] as const) {
        let ticks = 0;
        const bounded = chooseOpponentMove(position, level, [], config, 10, () => ticks++);
        expect(legalMoves(position)).toContainEqual(bounded.move);
        expect(ticks).toBeLessThanOrEqual(LEVEL_CFG[level].ms + 8);
      }
    }
    const mate = fromFEN("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const chosen = chooseOpponentMove(mate, "club", [], config, 1, fixed);
    const next = applyMove(mate, chosen.move!);
    expect(inCheck(next, next.turn)).toBe(true);
    expect(legalMoves(next)).toHaveLength(0);
  });
});

import { historicalFeatures, HISTORICAL_FEATURE_NAMES } from "../../src/engine/historical-features";
import { historicalStyle } from "../../src/engine/historical-morphy";
import model from "../../src/engine/morphy-model.json";

it("normalizes ten White-minus-Black features and preserves perspective without material discounts", () => {
  expect(HISTORICAL_FEATURE_NAMES).toHaveLength(10);
  const positions = [
    START(),
    fromFEN("r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7"),
    fromFEN("6k1/5ppp/8/5NQ1/2B5/8/PPP2PPP/3R1RK1 w - - 0 20"),
  ];
  for (const p of positions) {
    const features = historicalFeatures(p);
    expect(features).toHaveLength(10);
    features.forEach((value, i) => {
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
      expect(historicalFeatures(mirror(p))[i]).toBeCloseTo(-value);
    });
    const dot = features.reduce((sum, value, i) => sum + value * model.weights[i], 0);
    expect(historicalStyle(p)).toBeCloseTo(100 * Math.max(-2.5, Math.min(2.5, dot)));
    expect(historicalStyle(mirror(p))).toBeCloseTo(-historicalStyle(p));
    expect(Math.abs(historicalStyle(p))).toBeLessThanOrEqual(250);
    expect(Number.isFinite(evaluate(p) + historicalStyle(p))).toBe(true);
  }
  const p = START();
  const nf3 = legalMoves(p).find((move) => sanFor(p, move, applyMove(p, move)) === "Nf3")!;
  expect(historicalFeatures(applyMove(p, nf3))[0]).toBeGreaterThan(historicalFeatures(p)[0]);
  expect(model.weights.every((weight) => Number.isFinite(weight) && Math.abs(weight) <= 2)).toBe(
    true,
  );
});

import {
  fitPreferences,
  preferenceObjective,
  preferenceMetrics,
  sampleGamePositions,
  type PreferenceSample,
} from "../../scripts/morphy-history/train";

it("fits only supplied training choices with stable mate-extreme probabilities and the runtime clipped gradient", () => {
  const zeros = Array<number>(10).fill(0),
    active = [1, ...zeros.slice(1)];
  const sample: PreferenceSample = {
    gameId: "training",
    ply: 8,
    fen: "fixture",
    actual: 1,
    choices: [
      { uci: "a2a3", quality: 1000, features: zeros, legacy: 0, nodes: 1 },
      { uci: "e2e4", quality: 1000, features: active, legacy: 0, nodes: 1 },
    ],
  };
  const result = fitPreferences([sample]);
  expect(result.weights[0]).toBeGreaterThan(0);
  expect(preferenceMetrics([sample], result.weights).logLoss).toBeLessThan(
    preferenceMetrics([sample], zeros).logLoss,
  );
  expect(preferenceMetrics([sample], result.weights).accuracy).toBe(1);
  const weights = [...zeros];
  weights[0] = 0.4;
  const objective = preferenceObjective([sample], weights);
  const epsilon = 0.000001;
  const high = [...weights];
  high[0] += epsilon;
  const low = [...weights];
  low[0] -= epsilon;
  expect(objective.gradient[0]).toBeCloseTo(
    (preferenceObjective([sample], high).loss - preferenceObjective([sample], low).loss) /
      (2 * epsilon),
    6,
  );
  const clipped: PreferenceSample = {
    ...sample,
    choices: sample.choices.map((choice) => ({ ...choice, features: active.map(() => 1) })),
  };
  expect(
    preferenceObjective(
      [clipped],
      active.map(() => 2),
    ).gradient,
  ).toEqual(active.map(() => 0.02));
  expect(
    Number.isFinite(
      preferenceMetrics(
        [{ ...sample, choices: [sample.choices[0], { ...sample.choices[1], quality: -1000 }] }],
        zeros,
      ).logLoss,
    ),
  ).toBe(true);
});

it("samples at most eight eligible Morphy turns using fixed whole-game spacing", () => {
  const game = {
    id: "fixture",
    white: "Morphy",
    black: "Other",
    date: "1858",
    site: "Paris",
    morphyColor: "w" as const,
    moves: [
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bc4",
      "Bc5",
      "d3",
      "Nf6",
      "Nc3",
      "d6",
      "O-O",
      "O-O",
      "Be3",
      "Be6",
      "Qd2",
      "Qd7",
      "Rad1",
      "Rad8",
      "Rfe1",
      "Rfe8",
      "a3",
      "a6",
      "h3",
      "h6",
      "b3",
      "b6",
      "Kh1",
      "Kh8",
    ],
  };
  const samples = sampleGamePositions(game);
  expect(samples).toHaveLength(8);
  expect(samples[0].ply).toBe(8);
  expect(samples.at(-1)?.ply).toBe(26);
  expect(samples.every((sample) => sample.position.turn === "w" && sample.legal.length >= 2)).toBe(
    true,
  );
  expect(sampleGamePositions(game).map((sample) => sample.ply)).toEqual(
    samples.map((sample) => sample.ply),
  );
});

import * as trainingTool from "../../scripts/morphy-history/train";
import * as neutralSearch from "../../src/engine/search";
import { vi } from "vitest";

it("preserves a valid recorded continuation before looking for unrecorded mates, filtering stale entries", () => {
  const position = fromFEN("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"),
    key = posKey(position),
    previous = book[key];
  // Controlled book fixture isolates precedence independently of corpus composition.
  book[key] = [
    ["h1h8", 1000],
    ["f7e7", 1],
  ];
  try {
    const result = chooseOpponentMove(
      position,
      "casual",
      ["Qg7#"],
      opponents.historicalMorphyConfig(2),
      0,
      fixed,
    );
    expect(result.book).toBe(true);
    expect(uci(result.move)).toBe("f7e7");
    expect(legalMoves(position)).toContainEqual(result.move);
  } finally {
    if (previous) book[key] = previous;
    else delete book[key];
  }
});

it("excludes a whole sample at the candidate node cap and propagates unrelated scoring errors", () => {
  const position = START(),
    sample = { gameId: "cap-test", ply: 8, position, legal: legalMoves(position), actual: 0 };
  const realQuiesce = neutralSearch.quiesce;
  const spy = vi.spyOn(neutralSearch, "quiesce");
  try {
    spy.mockImplementation((position, alpha, beta, depth, ply, clock) => {
      for (let i = 0; i < 10000; i++) clock!();
      return realQuiesce(position, alpha, beta, depth, ply, clock);
    });
    const outcome = trainingTool.scoreSample(sample);
    expect(outcome).toMatchObject({
      excluded: { gameId: "cap-test", nodes: 10001, reason: "candidate-node-cap" },
    });
    expect(outcome).not.toHaveProperty("sample");
    spy.mockImplementation((_position, _alpha, _beta, _depth, _ply, clock) => {
      for (let i = 0; i < 10001; i++) clock!();
      throw new Error("unrelated evaluation failure");
    });
    expect(() => trainingTool.scoreSample(sample)).toThrow("unrelated evaluation failure");
  } finally {
    spy.mockRestore();
  }
});

it("keeps every whole holdout game out of fitting, even when its choices oppose training labels", () => {
  const zeros = Array<number>(10).fill(0),
    sample: PreferenceSample = {
      gameId: "train",
      ply: 8,
      fen: "fixture",
      actual: 1,
      choices: [
        { uci: "a2a3", quality: 0, features: zeros, legacy: 0, nodes: 1 },
        { uci: "e2e4", quality: 0, features: [1, ...zeros.slice(1)], legacy: 0, nodes: 1 },
      ],
    };
  const heldout = { ...sample, gameId: "serious", actual: 0 };
  const first = trainingTool.fitHistoricalPreferences([sample, heldout], ["serious"]);
  const second = trainingTool.fitHistoricalPreferences(
    [sample, { ...heldout, actual: 1 }, { ...heldout, ply: 10 }],
    ["serious"],
  );
  expect(first.fitted).toEqual(second.fitted);
  expect(first.training).toEqual([sample]);
  expect(first.holdout).toEqual([heldout]);
});
