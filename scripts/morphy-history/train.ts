import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { START, applyMove, legalMoves, sanFor, sqName, toFEN } from "../../src/engine/board";
import { historicalFeatures, HISTORICAL_FEATURE_NAMES } from "../../src/engine/historical-features";
import { morphyStyle } from "../../src/engine/morphy";
import { MATE, quiesce } from "../../src/engine/search";
import type { Move, Position } from "../../src/engine/types";
import type { HistoricalGame } from "./corpus";

export const TRAINING_PROTOCOL = {
  version: "historical-preference-v1",
  sampling:
    "Morphy turns only; ply >= 8; >= 2 legal moves; k=min(8,n); eligible index floor(i*(n-1)/(k-1)); k=1 selects index 0",
  holdout:
    "Entire games matching the serious collection excluded from training; book disabled for prediction on both splits; no final-holdout tuning",
  neutralQuality:
    "-quiesce(successor,-MATE,MATE,2,0,deterministicNodeClock)/100; successor side-to-move score inverted to current mover",
  candidateNodeCap: 10000,
  capExclusion:
    "Exclude entire sample if any candidate exceeds cap; do not replace excluded positions",
  steps: 200,
  learningRate: 0.15,
  l2: 0.01,
  regularizer: "0.5 * l2 * sum(weight^2)",
  weightBounds: [-2, 2],
  stylePawnBounds: [-2.5, 2.5],
  initialization: "ten zeros",
  objective:
    "mean actual-move softmax negative log likelihood + L2; quality + clipped dot(weights,moverSign*features); zero style derivative outside clipping interval",
  comparison:
    "same neutral quality + moverSign*morphyStyle(successor)/100; deterministic first-legal tie break for both top choices",
} as const;

interface SamplePosition {
  gameId: string;
  ply: number;
  position: Position;
  legal: Move[];
  actual: number;
}
interface PreferenceChoice {
  uci: string;
  quality: number;
  features: number[];
  legacy: number;
  nodes: number;
}
export interface PreferenceSample {
  gameId: string;
  ply: number;
  fen: string;
  actual: number;
  choices: PreferenceChoice[];
}

export function sampleGamePositions(game: HistoricalGame): SamplePosition[] {
  let position = START();
  const eligible: SamplePosition[] = [];
  for (const [ply, wanted] of game.moves.entries()) {
    const legal = legalMoves(position);
    const actual = legal.findIndex(
      (move) => sanFor(position, move, applyMove(position, move)) === wanted,
    );
    if (actual < 0) throw new Error(`Corpus replay failed: ${game.id} ply ${ply}: ${wanted}`);
    if (ply >= 8 && position.turn === game.morphyColor && legal.length >= 2)
      eligible.push({ gameId: game.id, ply, position, legal, actual });
    position = applyMove(position, legal[actual]);
  }
  const count = Math.min(8, eligible.length);
  return Array.from(
    { length: count },
    (_, i) => eligible[count === 1 ? 0 : Math.floor((i * (eligible.length - 1)) / (count - 1))],
  );
}

export function scoreSample(sample: SamplePosition):
  | { sample: PreferenceSample }
  | {
      excluded: {
        gameId: string;
        ply: number;
        fen: string;
        uci: string;
        nodes: number;
        reason: string;
      };
    } {
  const choices: PreferenceChoice[] = [],
    sign = sample.position.turn === "w" ? 1 : -1;
  for (const move of sample.legal) {
    const next = applyMove(sample.position, move),
      uci = `${sqName(move.from)}${sqName(move.to)}${move.promo ?? ""}`;
    let nodes = 0,
      capped = false,
      quality: number;
    try {
      quality =
        -quiesce(next, -MATE, MATE, 2, 0, () => {
          nodes++;
          if (nodes > TRAINING_PROTOCOL.candidateNodeCap) {
            capped = true;
            return Infinity;
          }
          return 0;
        }) / 100;
    } catch (error) {
      // The cap callback immediately causes the search's private TIMEOUT symbol.
      // Never hide unrelated failures (including an unexpected error at the cap).
      if (!capped || typeof error !== "symbol" || error.description !== "search-timeout")
        throw error;
      return {
        excluded: {
          gameId: sample.gameId,
          ply: sample.ply,
          fen: toFEN(sample.position),
          uci,
          nodes,
          reason: "candidate-node-cap",
        },
      };
    }
    choices.push({
      uci,
      quality,
      features: historicalFeatures(next).map((value) => sign * value),
      legacy: (sign * morphyStyle(next)) / 100,
      nodes,
    });
  }
  return {
    sample: {
      gameId: sample.gameId,
      ply: sample.ply,
      fen: toFEN(sample.position),
      actual: sample.actual,
      choices,
    },
  };
}

const dot = (weights: readonly number[], features: readonly number[]) =>
  weights.reduce((sum, weight, i) => sum + weight * features[i], 0);
const clippedStyle = (n: number) => Math.max(-2.5, Math.min(2.5, n));
function distribution(sample: PreferenceSample, weights: readonly number[], legacy: boolean) {
  const scores = sample.choices.map(
    (choice) =>
      choice.quality + (legacy ? choice.legacy : clippedStyle(dot(weights, choice.features))),
  );
  const max = Math.max(...scores),
    shifted = scores.map((score) => Math.exp(score - max)),
    sum = shifted.reduce((a, b) => a + b, 0);
  return {
    probabilities: shifted.map((value) => value / sum),
    loss: max - scores[sample.actual] + Math.log(sum),
    top: scores.indexOf(max),
  };
}

export function preferenceObjective(
  samples: readonly PreferenceSample[],
  weights: readonly number[],
) {
  if (!samples.length) throw new Error("No training samples.");
  let loss = 0;
  const gradient = Array<number>(HISTORICAL_FEATURE_NAMES.length).fill(0);
  for (const sample of samples) {
    const { probabilities, loss: sampleLoss } = distribution(sample, weights, false);
    loss += sampleLoss;
    sample.choices.forEach((choice, j) => {
      const style = dot(weights, choice.features);
      if (style <= -2.5 || style >= 2.5) return;
      const residual = probabilities[j] - Number(j === sample.actual);
      choice.features.forEach((feature, i) => {
        gradient[i] += residual * feature;
      });
    });
  }
  return {
    loss:
      loss / samples.length +
      (TRAINING_PROTOCOL.l2 * weights.reduce((sum, weight) => sum + weight * weight, 0)) / 2,
    gradient: gradient.map(
      (value, i) => value / samples.length + TRAINING_PROTOCOL.l2 * weights[i],
    ),
  };
}

export function fitPreferences(samples: readonly PreferenceSample[]) {
  let weights = Array<number>(HISTORICAL_FEATURE_NAMES.length).fill(0);
  const checkpoints: { step: number; objective: number }[] = [];
  for (let step = 0; step < TRAINING_PROTOCOL.steps; step++) {
    const { loss, gradient } = preferenceObjective(samples, weights);
    if (step % 50 === 0) checkpoints.push({ step, objective: loss });
    weights = weights.map((weight, i) =>
      Math.max(-2, Math.min(2, weight - TRAINING_PROTOCOL.learningRate * gradient[i])),
    );
  }
  checkpoints.push({
    step: TRAINING_PROTOCOL.steps,
    objective: preferenceObjective(samples, weights).loss,
  });
  return { weights, checkpoints };
}

/** The fitting boundary receives only games outside the frozen holdout, never its labels. */
export function fitHistoricalPreferences(
  samples: readonly PreferenceSample[],
  holdoutIds: readonly string[],
) {
  const ids = new Set(holdoutIds);
  const training = samples.filter((sample) => !ids.has(sample.gameId));
  const holdout = samples.filter((sample) => ids.has(sample.gameId));
  return { training, holdout, fitted: fitPreferences(training) };
}

export function preferenceMetrics(
  samples: readonly PreferenceSample[],
  weights: readonly number[],
  legacy = false,
) {
  if (!samples.length) throw new Error("No evaluation samples.");
  let logLoss = 0,
    correct = 0;
  for (const sample of samples) {
    const prediction = distribution(sample, weights, legacy);
    logLoss += prediction.loss;
    correct += Number(prediction.top === sample.actual);
  }
  return {
    samples: samples.length,
    correct,
    accuracy: correct / samples.length,
    logLoss: logLoss / samples.length,
  };
}

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

async function train() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const corpus = JSON.parse(readFileSync(resolve(root, "src/book/morphy-games.json"), "utf8")) as {
    games: HistoricalGame[];
    holdoutIds: string[];
  };
  const holdoutIds = new Set(corpus.holdoutIds),
    collected: PreferenceSample[] = [];
  const excluded: Array<{
    split: string;
    gameId: string;
    ply: number;
    fen: string;
    uci: string;
    nodes: number;
    reason: string;
  }> = [];
  let sampled = 0;
  for (const [index, game] of corpus.games.entries()) {
    const split = holdoutIds.has(game.id) ? "holdout" : "training";
    for (const sample of sampleGamePositions(game)) {
      sampled++;
      const result = scoreSample(sample);
      if ("excluded" in result) excluded.push({ split, ...result.excluded });
      else collected.push(result.sample);
    }
    if ((index + 1) % 20 === 0)
      console.log(
        `Scored ${index + 1}/${corpus.games.length} games; ${collected.filter((sample) => !holdoutIds.has(sample.gameId)).length} train, ${collected.filter((sample) => holdoutIds.has(sample.gameId)).length} holdout, ${excluded.length} excluded`,
      );
  }
  const { training, holdout, fitted } = fitHistoricalPreferences(collected, corpus.holdoutIds);
  // This is the sole final-holdout evaluation; no fitting call can see these samples.
  const metrics = {
    training: {
      historical: preferenceMetrics(training, fitted.weights),
      legacy: preferenceMetrics(training, fitted.weights, true),
    },
    holdout: {
      historical: preferenceMetrics(holdout, fitted.weights),
      legacy: preferenceMetrics(holdout, fitted.weights, true),
    },
  };
  const sourcePaths = [
    "src/book/morphy-games.json",
    "src/book/morphy-book.json",
    "src/engine/historical-features.ts",
    "src/engine/historical-morphy.ts",
    "src/engine/board.ts",
    "src/engine/eval.ts",
    "src/engine/search.ts",
    "src/engine/morphy.ts",
    "scripts/morphy-history/train.ts",
  ];
  const hashes = Object.fromEntries(
    sourcePaths.map((path) => [path, sha256(readFileSync(resolve(root, path)))]),
  );
  const model = {
    schemaVersion: 1,
    policy: "historical-v1",
    featureNames: HISTORICAL_FEATURE_NAMES,
    weights: fitted.weights,
    stylePawnBounds: TRAINING_PROTOCOL.stylePawnBounds,
    trainingProtocol: TRAINING_PROTOCOL.version,
    corpusSha256: hashes["src/book/morphy-games.json"],
    featuresSha256: hashes["src/engine/historical-features.ts"],
  };
  const modelText = await format(JSON.stringify(model), { parser: "json", printWidth: 100 });
  const report = {
    schemaVersion: 1,
    protocol: TRAINING_PROTOCOL,
    featureNames: HISTORICAL_FEATURE_NAMES,
    weights: fitted.weights,
    sourceHashes: hashes,
    modelSha256: sha256(modelText),
    counts: {
      games: corpus.games.length,
      trainingGames: corpus.games.length - holdoutIds.size,
      holdoutGames: holdoutIds.size,
      sampled,
      training: training.length,
      holdout: holdout.length,
      excluded: excluded.length,
    },
    trainingGameIds: corpus.games.filter((game) => !holdoutIds.has(game.id)).map((game) => game.id),
    holdoutGameIds: corpus.holdoutIds,
    checkpoints: fitted.checkpoints,
    metrics,
    improvesHeldoutLoss: metrics.holdout.historical.logLoss < metrics.holdout.legacy.logLoss,
    scoredSamplesSha256: sha256(JSON.stringify({ training, holdout })),
    samples: [
      ...training.map((sample) => ({ split: "training", ...sample })),
      ...holdout.map((sample) => ({ split: "holdout", ...sample })),
    ].map((sample) => ({
      split: sample.split,
      gameId: sample.gameId,
      ply: sample.ply,
      fen: sample.fen,
      actual: sample.choices[sample.actual].uci,
      legalChoices: sample.choices.length,
      maximumCandidateNodes: Math.max(...sample.choices.map((choice) => choice.nodes)),
    })),
    excluded,
    limitations: [
      "Whole-game separation prevents direct game leakage in fitting, but shared opening positions and historical opponents remain correlated.",
      "The runtime book includes the held-out games; prediction results disable the book and assess off-book static preference only, not independent end-to-end play.",
      "Small historical collection and board-local proxies cannot reconstruct a person's thought process. Castling placement is not proof of castling history; mobility ignores pins.",
      "Neutral depth-two capture quality can miss deeper tactics; node-cap exclusions are retained without replacement.",
      "Strength remains unmeasured for version 3; this task does not enable rating.",
    ],
  };
  mkdirSync(resolve(root, "docs/verification/morphy-history"), { recursive: true });
  writeFileSync(
    resolve(root, "docs/verification/morphy-history/training.json"),
    await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  );
  if (report.improvesHeldoutLoss)
    writeFileSync(resolve(root, "src/engine/morphy-model.json"), modelText);
  else
    throw new Error(
      "Fixed model did not improve held-out loss; report retained, model not selected. Escalate before changing protocol.",
    );
  console.log(
    JSON.stringify(
      { counts: report.counts, metrics, weights: fitted.weights, modelSha256: report.modelSha256 },
      null,
      2,
    ),
  );
}

if (
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await train();
