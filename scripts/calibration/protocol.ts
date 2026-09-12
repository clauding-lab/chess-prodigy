import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import { LEVEL_CFG } from "../../src/engine/search";
import type { Level } from "../../src/engine/types";
import { ENGINE_ELO } from "../../src/rating/fide";
import { sampleOpening } from "./core";

export const LEGACY_PROTOCOL = "morphy-paired-v1";
export const HISTORICAL_PROTOCOL = "morphy-historical-paired-v1";
export const PLANS_PROTOCOL = "morphy-plans-paired-v1";
export type CalibrationProtocol =
  typeof LEGACY_PROTOCOL | typeof HISTORICAL_PROTOCOL | typeof PLANS_PROTOCOL;

export const EXPECTED_SOURCE_FILES = Object.freeze([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.server.json",
  "src/engine/board.ts",
  "src/engine/eval.ts",
  "src/engine/search.ts",
  "src/engine/morphy.ts",
  "src/engine/morphy-plans.ts",
  "src/engine/opponents.ts",
  "src/engine/historical-features.ts",
  "src/engine/historical-morphy.ts",
  "src/engine/morphy-model.json",
  "src/engine/types.ts",
  "src/book/lines.ts",
  "src/book/book.ts",
  "src/book/morphy-games.json",
  "src/book/morphy-book.json",
  "src/rating/fide.ts",
  "scripts/morphy-history/corpus.ts",
  "scripts/morphy-history/import.ts",
  "scripts/morphy-history/train.ts",
  "docs/verification/morphy-history/training.json",
  "scripts/calibration/core.ts",
  "scripts/calibration/protocol.ts",
  "scripts/calibration/match.ts",
  "scripts/calibration/run.ts",
  "scripts/calibration/worker.ts",
  "scripts/calibration/plans-behaviour.ts",
  "docs/verification/morphy-plans/behaviour-protocol.md",
]);

export interface CalibrationOpponentIdentity {
  id: "attack-development";
  version: 1 | 3 | 4;
  engine: "style-v1" | "historical-v1" | "plans-v1";
  randomPolicy: "seeded-per-ply-v1";
}

export interface CalibrationManifest {
  schemaVersion: 2;
  protocol: CalibrationProtocol;
  opponent: CalibrationOpponentIdentity;
  classic: {
    id: "classic";
    version: 1;
    engine: "classic-v1";
    randomPolicy: "seeded-match-stream-v1";
    book: "production-book-v1";
  };
  level: Level;
  maxPlies: number;
  anchor: number;
  productionSettings: {
    classic: (typeof LEVEL_CFG)[Level];
    morphy: (typeof LEVEL_CFG)[Level];
  };
  openingPolicy: "sampled-six-ply-v1" | "start-position-v1";
  pairSeedPolicy: "color-swapped-20260912-v1";
  adjudication: "none";
  checkpoints: readonly [50, 100, 200];
  interval: { method: "approximate-pair-wilson-v1"; z: 2.4; maximumWidth: 300 };
  node: string;
  arch: string;
  platform: string;
  cpu: string;
  cpuCount: number;
  concurrency: number;
  source: Record<string, string>;
}

export function parseProtocol(value: string | undefined): CalibrationProtocol {
  if (value === undefined) return LEGACY_PROTOCOL;
  if (value === LEGACY_PROTOCOL || value === HISTORICAL_PROTOCOL || value === PLANS_PROTOCOL)
    return value;
  throw new Error(`Unsupported calibration protocol: ${value}`);
}

export function opponentIdentity(protocol: CalibrationProtocol): CalibrationOpponentIdentity {
  if (protocol === PLANS_PROTOCOL)
    return {
      id: "attack-development",
      version: 4,
      engine: "plans-v1",
      randomPolicy: "seeded-per-ply-v1",
    };
  return protocol === HISTORICAL_PROTOCOL
    ? {
        id: "attack-development",
        version: 3,
        engine: "historical-v1",
        randomPolicy: "seeded-per-ply-v1",
      }
    : {
        id: "attack-development",
        version: 1,
        engine: "style-v1",
        randomPolicy: "seeded-per-ply-v1",
      };
}

export function openingForProtocol(protocol: CalibrationProtocol, seed: number): string[] {
  return protocol === LEGACY_PROTOCOL ? sampleOpening(seed) : [];
}

export function sourceFingerprints(): Record<string, string> {
  return Object.fromEntries(
    EXPECTED_SOURCE_FILES.map((file) => [
      file,
      createHash("sha256").update(readFileSync(file)).digest("hex"),
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertExactSourceFingerprints(
  source: unknown,
): asserts source is Record<string, string> {
  if (!isRecord(source)) throw new Error("Calibration manifest fingerprints are missing");
  const supplied = Object.keys(source).sort(),
    expected = [...EXPECTED_SOURCE_FILES].sort();
  if (JSON.stringify(supplied) !== JSON.stringify(expected))
    throw new Error("Calibration manifest fingerprint set mismatch");
  for (const file of EXPECTED_SOURCE_FILES) {
    const hash = source[file];
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error(`Calibration manifest fingerprint is invalid: ${file}`);
    const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (actual !== hash) throw new Error(`Calibration source fingerprint mismatch: ${file}`);
  }
}

export function machineIdentity() {
  const processors = cpus();
  return {
    node: process.version,
    arch: arch(),
    platform: platform(),
    cpu: processors[0]?.model ?? "",
    cpuCount: processors.length,
  };
}

export function assertManifest(
  value: unknown,
  expected: { level: Level; protocol: CalibrationProtocol },
): asserts value is CalibrationManifest {
  if (!isRecord(value)) throw new Error("Calibration manifest is invalid");
  const machine = machineIdentity(),
    expectedOpponent = opponentIdentity(expected.protocol),
    expectedClassic = {
      id: "classic",
      version: 1,
      engine: "classic-v1",
      randomPolicy: "seeded-match-stream-v1",
      book: "production-book-v1",
    },
    expectedSettings = { classic: LEVEL_CFG[expected.level], morphy: LEVEL_CFG[expected.level] },
    expectedOpening =
      expected.protocol === LEGACY_PROTOCOL ? "sampled-six-ply-v1" : "start-position-v1";
  if (
    value.schemaVersion !== 2 ||
    value.protocol !== expected.protocol ||
    value.level !== expected.level ||
    JSON.stringify(value.opponent) !== JSON.stringify(expectedOpponent) ||
    JSON.stringify(value.classic) !== JSON.stringify(expectedClassic) ||
    value.anchor !== ENGINE_ELO[expected.level] ||
    JSON.stringify(value.productionSettings) !== JSON.stringify(expectedSettings) ||
    value.openingPolicy !== expectedOpening ||
    value.pairSeedPolicy !== "color-swapped-20260912-v1" ||
    value.adjudication !== "none" ||
    JSON.stringify(value.checkpoints) !== JSON.stringify([50, 100, 200]) ||
    JSON.stringify(value.interval) !==
      JSON.stringify({ method: "approximate-pair-wilson-v1", z: 2.4, maximumWidth: 300 }) ||
    value.node !== machine.node ||
    value.arch !== machine.arch ||
    value.platform !== machine.platform ||
    value.cpu !== machine.cpu ||
    machine.cpu.length === 0 ||
    value.cpuCount !== machine.cpuCount ||
    !Number.isSafeInteger(value.concurrency) ||
    Number(value.concurrency) < 1 ||
    Number(value.concurrency) > machine.cpuCount ||
    !Number.isSafeInteger(value.maxPlies) ||
    Number(value.maxPlies) < 1 ||
    Number(value.maxPlies) > 1000
  )
    throw new Error("Calibration manifest identity or machine mismatch");
  assertExactSourceFingerprints(value.source);
}
