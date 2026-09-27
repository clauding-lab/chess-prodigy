/** R18/F52: synthetic outcome analysis, never playing or rating real games.
 * Run: node --import tsx docs/verification/repair-20260927/calibration-statistics.ts
 * Trials are independent. Each pair has the joint distribution declared below;
 * pairs are iid within a trial. Truth is Elo of the expected two-colour score.
 */
import { estimate, seededRandom, type Score } from "../../../scripts/calibration/core";
const trials = 20_000;
const anchor = 900;
type Model = {
  name: string;
  wins: number;
  draws: number;
  coupling: "independent" | "concordant" | "antithetic";
  whiteWinShift?: number;
};
const models: Model[] = [
  { name: "Casual independent", wins: 0.73, draws: 0.17, coupling: "independent" },
  { name: "Casual concordant pair", wins: 0.73, draws: 0.17, coupling: "concordant" },
  { name: "Casual antithetic pair", wins: 0.73, draws: 0.17, coupling: "antithetic" },
  {
    name: "Casual colour asymmetry",
    wins: 0.73,
    draws: 0.17,
    coupling: "independent",
    whiteWinShift: 0.07,
  },
  { name: "Mirrored weak independent", wins: 0.1, draws: 0.17, coupling: "independent" },
  { name: "Balanced draw heavy", wins: 0.25, draws: 0.5, coupling: "independent" },
  { name: "Extreme dominance", wins: 0.98, draws: 0.01, coupling: "independent" },
];
function score(u: number, w: number, d: number): Score {
  return u < w ? 1 : u < w + d ? 0.5 : 0;
}
function metrics(values: { error: number; roundedError: number; covered: boolean }[]) {
  if (!values.length) return { count: 0 };
  const mean = values.reduce((s, v) => s + v.error, 0) / values.length;
  const mse = values.reduce((s, v) => s + v.error ** 2, 0) / values.length;
  return {
    count: values.length,
    bias: mean,
    biasMonteCarloSE: Math.sqrt(Math.max(0, mse - mean ** 2) / values.length),
    rmse: Math.sqrt(mse),
    roundedBias: values.reduce((s, v) => s + v.roundedError, 0) / values.length,
    intervalCoverage: values.filter((v) => v.covered).length / values.length,
  };
}
const output = models.map((model, index) => {
  const random = seededRandom(0x18520000 + index);
  const p = model.wins + model.draws / 2;
  const truth = anchor + 400 * Math.log10(p / (1 - p));
  type Result = Parameters<typeof metrics>[0][number];
  const buckets: Record<string, Result[]> = {
    stoppedOverall: [],
    acceptedOnly: [],
    stop50: [],
    stop100: [],
    stop200: [],
    fixed100: [],
    fixed200: [],
  };
  const stopCounts: Record<string, number> = { 50: 0, 100: 0, 200: 0 };
  let rejectedAtCap = 0;
  function record(bucket: string, measured: ReturnType<typeof estimate>) {
    if (measured.rating === null) return;
    buckets[bucket].push({
      error: measured.rating - truth,
      roundedError: Math.round(measured.rating / 25) * 25 - truth,
      covered:
        measured.lower !== null &&
        measured.upper !== null &&
        measured.lower <= truth &&
        truth <= measured.upper,
    });
  }
  for (let trial = 0; trial < trials; trial++) {
    const pairs: [Score, Score][] = Array.from({ length: 200 }, () => {
      const u = random(),
        v =
          model.coupling === "independent" ? random() : model.coupling === "concordant" ? u : 1 - u;
      return [
        score(u, model.wins + (model.whiteWinShift ?? 0), model.draws),
        score(v, model.wins - (model.whiteWinShift ?? 0), model.draws),
      ];
    });
    const e50 = estimate(pairs.slice(0, 50), anchor),
      e100 = estimate(pairs.slice(0, 100), anchor),
      e200 = estimate(pairs, anchor);
    const stop = e50.eligible ? 50 : e100.eligible ? 100 : 200;
    const selected = stop === 50 ? e50 : stop === 100 ? e100 : e200;
    stopCounts[stop]++;
    if (!selected.eligible) rejectedAtCap++;
    record("stoppedOverall", selected);
    record(`stop${stop}`, selected);
    if (selected.eligible) record("acceptedOnly", selected);
    record("fixed100", e100);
    record("fixed200", e200);
  }
  return {
    model,
    truth,
    trials,
    stopCounts,
    rejectedAtCap,
    metrics: Object.fromEntries(
      Object.entries(buckets).map(([key, values]) => [key, metrics(values)]),
    ),
  };
});
console.log(
  JSON.stringify(
    {
      seedBase: "0x18520000 + model index",
      trialsPerModel: trials,
      estimator: "unchanged approximate-pair-wilson-v1; z=2.4; width<=300",
      interpretation:
        "Synthetic assumed outcomes only. Finite estimates counted explicitly. Fixed-size comparators include all finite estimates regardless of width; they are error analyses, not proposed rating eligibility. Coverage is empirical under the declared model, not a sequential confidence guarantee.",
      output,
    },
    null,
    2,
  ),
);
