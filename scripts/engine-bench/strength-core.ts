import { chigorinConfig, rosterConfig } from "../../src/engine/opponents";
import type { Level } from "../../src/engine/types";
import type { ExperimentId } from "../../src/engine/next/plans";
import type { Score } from "../calibration/core";

export type StrengthBaseline = ExperimentId | "spassky" | "chigorin";
export const strengthBaselineConfig = (id: StrengthBaseline, seed: number) =>
  id === "chigorin" ? chigorinConfig(seed) : rosterConfig(id, seed);

export interface StrengthRow {
  key: string;
  candidate: ExperimentId;
  baseline: StrengthBaseline;
  level: Level;
  pair: number;
  color: "w" | "b";
  seed: number;
  baselineSeed: number;
}
// FNV-1a, UTF-16 code units (all protocol labels are ASCII), unsigned 32-bit overflow.
export function strengthSeed(label: string): number {
  let hash = 2166136261;
  for (let i = 0; i < label.length; i++)
    hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
  return hash;
}
// Development only. Validation stays unavailable until its independent method review closes.
export function strengthSchedule(
  split: "development",
  candidate: ExperimentId,
  level: Level,
  baseline: StrengthBaseline,
): StrengthRow[] {
  if (
    split !== "development" ||
    !["tal", "fischer"].includes(candidate) ||
    baseline !== candidate ||
    !["casual", "club", "strong"].includes(level)
  )
    throw new Error("Unsupported development schedule");
  return Array.from({ length: 20 }, (_, pair) => {
    const label = `coherent-strength-v1:development:${candidate}:${level}:${pair}`;
    return (["w", "b"] as const).map((color) => ({
      key: `${candidate}-${level}-${pair}-${color}`,
      candidate,
      baseline,
      level,
      pair,
      color,
      seed: strengthSeed(label),
      baselineSeed: strengthSeed(`${label}:baseline:${baseline}`),
    }));
  }).flat();
}
export function pairedInterval(pairs: readonly (readonly [Score, Score])[]) {
  if (
    !Array.isArray(pairs) ||
    !pairs.length ||
    Array.from(pairs).some(
      (pair) =>
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        Array.from(pair).some((score) => score !== 0 && score !== 0.5 && score !== 1),
    )
  )
    throw new Error("Complete scored pairs are required");
  const means = pairs.map((pair) => (pair[0] + pair[1]) / 2);
  let state = 0x29c0ffee;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const samples = Array.from({ length: 10000 }, () => {
    let total = 0;
    for (let n = 0; n < means.length; n++) total += means[Math.floor(random() * means.length)];
    return total / means.length;
  }).sort((a, b) => a - b);
  return {
    mean: means.reduce((a, b) => a + b, 0) / means.length,
    lower: samples[249],
    upper: samples[9749],
    pairs: pairs.length,
  };
}
