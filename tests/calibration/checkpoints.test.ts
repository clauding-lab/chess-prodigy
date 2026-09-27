// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  estimate,
  intervalWithinLimit,
  CALIBRATION_INTERVAL,
  type Score,
} from "../../scripts/calibration/core";

const fake = vi.hoisted(() => ({
  score: (color: string, _seed: number): Score | null => (color === "w" ? 1 : 0),
}));
vi.mock("../../scripts/calibration/match", () => ({
  playMatch: vi.fn((options: { morphyColor: string; seed: number }) => ({
    ...options,
    score: fake.score(options.morphyColor, options.seed),
  })),
  verifySavedMatch: vi.fn(),
}));
const directories: string[] = [];
const argv = process.argv;
afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function directory() {
  const dir = mkdtempSync(join(tmpdir(), "calibration-checkpoints-"));
  directories.push(dir);
  return dir;
}
async function run(dir: string, pairs = 100, flags: string[] = []) {
  vi.resetModules();
  process.argv = [
    "node",
    "run.ts",
    "casual",
    dir,
    String(pairs),
    "1000",
    "fischer-plans-paired-v1",
    ...flags,
  ];
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../scripts/calibration/run");
}
function summary(dir: string, name = "casual-summary.json") {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

test("runner stops at first eligible checkpoint even when asked for 100 pairs; resuming later is rejected", async () => {
  fake.score = (color) => (color === "w" ? 1 : 0);
  const dir = directory();
  await run(dir);
  expect(summary(dir)).toMatchObject({ pairs: 50, eligible: true });
  const path = join(dir, "casual-50-summary.json");
  const original = readFileSync(path, "utf8");
  await expect(run(dir, 49)).rejects.toThrow(/checkpoint/i);
  expect(summary(dir)).toMatchObject({ pairs: 50, eligible: true });
  expect(existsSync(join(dir, "casual-0050-w.json"))).toBe(false);
  await expect(run(dir)).rejects.toThrow(/accepted checkpoint/i);
  expect(readFileSync(path, "utf8")).toBe(original);
  expect(summary(dir)).toMatchObject({ pairs: 50, eligible: true });
});

test("checkpoint files are immutable and a conflicting saved summary is rejected", async () => {
  fake.score = (color) => (color === "w" ? 1 : 0);
  const dir = directory();
  await run(dir, 50);
  const path = join(dir, "casual-50-summary.json");
  writeFileSync(path, '{"eligible":false}\n');
  await expect(run(dir, 50)).rejects.toThrow(/immutable checkpoint/i);
  expect(readFileSync(path, "utf8")).toBe('{"eligible":false}\n');
});

test("explicit exploratory runs retain every checkpoint but never qualify for rated evidence", async () => {
  fake.score = (color) => (color === "w" ? 1 : 0);
  const dir = directory();
  await run(dir, 100, ["--exploratory"]);
  expect(summary(dir, "casual-50-summary.json")).toMatchObject({
    eligible: false,
    purpose: "exploratory",
  });
  expect(summary(dir, "casual-100-summary.json")).toMatchObject({
    eligible: false,
    purpose: "exploratory",
    supersededBy: 50,
  });
  await expect(run(dir, 100)).rejects.toThrow(/manifest mismatch/i);
});

test("unresolved pairs cannot qualify at the cap", async () => {
  fake.score = () => null;
  const dir = directory();
  await run(dir, 200);
  expect(summary(dir)).toMatchObject({ pairs: 200, eligible: false, unresolved: 400 });
});

test("retained Fischer rejected and accepted Casual estimates reproduce exactly", () => {
  for (const n of [50, 100]) {
    const saved = JSON.parse(
      readFileSync(`docs/verification/roster/fischer/calibration/casual-${n}-summary.json`, "utf8"),
    );
    const scores: Score[] = [
      ...Array(saved.wins).fill(1),
      ...Array(saved.draws).fill(0.5),
      ...Array(saved.losses).fill(0),
    ];
    const pairs = Array.from({ length: n }, (_, i) => [scores[2 * i], scores[2 * i + 1]] as const);
    const actual = estimate(pairs, 900);
    expect(actual.rating).toBe(saved.rating);
    expect(actual.lower).toBe(saved.lower);
    expect(actual.upper).toBe(saved.upper);
    expect(actual.eligible).toBe(n === 100);
  }
});

test("declared interval includes width 300 exactly and rejects either side of invalid bounds", () => {
  expect(CALIBRATION_INTERVAL).toEqual({
    method: "approximate-pair-wilson-v1",
    z: 2.4,
    maximumWidth: 300,
  });
  expect(intervalWithinLimit(1000, 1300)).toBe(true);
  expect(intervalWithinLimit(1000, 1300 - 1e-9)).toBe(true);
  expect(intervalWithinLimit(1000, 1300 + 1e-9)).toBe(false);
  expect(intervalWithinLimit(1000, Infinity)).toBe(false);
  expect(intervalWithinLimit(1000, 999)).toBe(false);
});

test("all retained Casual checkpoints preserve their exact historical estimator outputs", () => {
  const roots = [
    "morphy-calibration-20260912",
    "morphy-history/calibration-20260912",
    "morphy-plans/calibration-20260912",
    "chigorin/calibration-20260913",
    ...["spassky", "tal", "fischer"].map((id) => `roster/${id}/calibration`),
  ];
  for (const root of roots) {
    const games = gunzipSync(readFileSync(`docs/verification/${root}/games.jsonl.gz`))
      .toString()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .map((record) => record.game ?? record)
      .filter((game) => game.level === "casual");
    const bySeed = new Map<number, [Score | null, Score | null]>();
    for (const game of games) {
      const pair = bySeed.get(game.seed) ?? [null, null];
      pair[game.morphyColor === "w" ? 0 : 1] = game.score;
      bySeed.set(game.seed, pair);
    }
    const pairs = [...bySeed.entries()].sort(([a], [b]) => a - b).map(([, pair]) => pair);
    const acceptedPairs = root.includes("spassky") ? 50 : 100;
    expect(pairs).toHaveLength(acceptedPairs);
    for (const n of [50, 100].filter((n) => n <= pairs.length)) {
      const actual = estimate(pairs.slice(0, n), 900);
      expect(actual.eligible, `${root}/${n}`).toBe(n === acceptedPairs);
      const checkpoint = `docs/verification/${root}/casual-${n}-summary.json`;
      const path = existsSync(checkpoint)
        ? checkpoint
        : n === acceptedPairs
          ? `docs/verification/${root}/casual-summary.json`
          : null;
      if (path) {
        const saved = JSON.parse(readFileSync(path, "utf8"));
        expect(actual.rating, path).toBe(saved.rating);
        expect(actual.lower, path).toBe(saved.lower);
        expect(actual.upper, path).toBe(saved.upper);
        expect(actual.eligible, path).toBe(saved.eligible);
      }
    }
  }
});

test("verification cannot turn missing fixture games into accepted evidence", async () => {
  const dir = directory();
  await expect(run(dir, 50, ["--verify-only"])).rejects.toThrow(/requires saved match/i);
  expect(existsSync(join(dir, "casual-50-summary.json"))).toBe(false);
});

test("runner retains a rejected 50-pair checkpoint then accepts 100 and cannot replace it at 200", async () => {
  const scores: Score[] = [
    ...Array(82).fill(1),
    ...Array(15).fill(0.5),
    ...Array(3).fill(0),
    ...Array(81).fill(1),
    ...Array(13).fill(0.5),
    ...Array(6).fill(0),
  ];
  fake.score = (color, seed) => scores[2 * ((seed - 0x20260912) / 7919) + (color === "w" ? 0 : 1)];
  const dir = directory();
  await run(dir, 200);
  expect(summary(dir, "casual-50-summary.json")).toMatchObject({
    eligible: false,
    wins: 82,
    draws: 15,
    losses: 3,
  });
  expect(summary(dir, "casual-100-summary.json")).toMatchObject({
    eligible: true,
    wins: 163,
    draws: 28,
    losses: 9,
  });
  expect(summary(dir)).toMatchObject({ pairs: 100, eligible: true });
  expect(existsSync(join(dir, "casual-0100-w.json"))).toBe(false);
  await expect(run(dir, 200)).rejects.toThrow(/accepted checkpoint/i);
  expect(summary(dir)).toMatchObject({ pairs: 100, eligible: true });
  await expect(run(dir, 75)).rejects.toThrow(/checkpoint/i);
  expect(summary(dir)).toMatchObject({ pairs: 100, eligible: true });
});
