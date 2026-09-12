import { expect, test } from "vitest";
import { fromFEN, START, posKey } from "../../src/engine/board";
import { terminalScore, estimate, seededRandom } from "../../scripts/calibration/core";

test("scores mate from White's side and distinguishes unfinished games from draws", () => {
  expect(terminalScore(fromFEN("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"), new Map())).toBe(1);
  expect(terminalScore(fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), new Map())).toBe(0.5);
  expect(terminalScore(START(), new Map())).toBeNull();
  expect(terminalScore(START(), new Map([[posKey(START()), 3]]))).toBe(0.5);
});
test("balanced pairs stay at the reference rating with nonzero uncertainty", () => {
  const result = estimate(
    Array.from({ length: 50 }, () => [1, 0] as const),
    1350,
  );
  expect(result.rating).toBe(1350);
  expect(result.lower).toBeGreaterThan(1200);
  expect(result.lower).toBeLessThan(1350);
  expect(result.upper).toBeGreaterThan(1350);
  expect(result.eligible).toBe(true);
});
test("does not claim calibration for domination, small samples or unfinished games", () => {
  expect(estimate([[1, 0]], 1350).eligible).toBe(false);
  expect(
    estimate(
      Array.from({ length: 50 }, () => [1, 1] as const),
      1350,
    ).eligible,
  ).toBe(false);
  const pairs = Array.from({ length: 50 }, () => [null, null] as const);
  expect(estimate(pairs, 1350).eligible).toBe(false);
});
test("match randomness repeats within its seed without becoming constant", () => {
  const a = seededRandom(42),
    b = seededRandom(42);
  const values = Array.from({ length: 10 }, () => a());
  expect(values).toEqual(Array.from({ length: 10 }, () => b()));
  expect(new Set(values).size).toBe(10);
  expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
});

test("plays opening SAN legally and records a forced mate without an invented result", async () => {
  const { playMatch } = await import("../../scripts/calibration/match");
  const game = playMatch({
    level: "casual",
    morphyColor: "b",
    seed: 12,
    opening: ["f3", "e5", "g4", "Qh4#"],
    maxPlies: 1000,
  });
  expect(game.score).toBe(1);
  expect(game.moves).toEqual(["f3", "e5", "g4", "Qh4#"]);
  expect(game.terminal).toBe(true);
  expect(() =>
    playMatch({ level: "casual", morphyColor: "w", seed: 12, opening: ["Ke7"], maxPlies: 1000 }),
  ).toThrow(/illegal/i);
});
test("a safety cutoff preserves legal moves and reports unresolved, not a draw", async () => {
  const { playMatch } = await import("../../scripts/calibration/match");
  const game = playMatch({
    level: "casual",
    morphyColor: "w",
    seed: 12,
    opening: ["e4", "e5"],
    maxPlies: 2,
  });
  expect(game.score).toBeNull();
  expect(game.terminal).toBe(false);
  expect(game.moves).toEqual(["e4", "e5"]);
});

test("runner persists an unresolved game without rating it and rejects changed resume settings", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-runner-test-"));
  const run = (limit: string) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/calibration/run.ts", "casual", dir, "1", limit],
      { encoding: "utf8" },
    );
  try {
    const first = run("2");
    expect(first.status, first.stderr).toBe(0);
    const summary = JSON.parse(readFileSync(join(dir, "casual-summary.json"), "utf8"));
    expect(summary.unresolved).toBe(2);
    expect(summary.eligible).toBe(false);
    expect(run("3").status).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("only the three predefined statistical checkpoints can qualify", () => {
  const pairs = Array.from({ length: 51 }, () => [1, 0] as const);
  expect(estimate(pairs, 1350).eligible).toBe(false);
});
test("every sampled opening uses six legal plies regardless of short book entries", async () => {
  const { sampleOpening } = await import("../../scripts/calibration/core");
  const openings = Array.from({ length: 100 }, (_, seed) => sampleOpening(seed));
  expect(openings.every((o) => o.length === 6)).toBe(true);
  expect(new Set(openings.map((o) => o.join(" "))).size).toBeGreaterThan(20);
});

test("a calibration pair worker resumes the declared protocol and never overwrites completed games", async () => {
  const { mkdtempSync, readFileSync, writeFileSync, rmSync, unlinkSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-worker-test-"));
  try {
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/calibration/run.ts", "casual", dir, "1", "2"],
      { encoding: "utf8" },
    );
    expect(run.status, run.stderr).toBe(0);
    const path = join(dir, "casual-0000-w.json"),
      before = readFileSync(path, "utf8");
    unlinkSync(join(dir, "casual-0000-b.json"));
    const worker = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/calibration/worker.ts", "casual", dir, "0"],
      { encoding: "utf8" },
    );
    expect(worker.status, worker.stderr).toBe(0);
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(JSON.parse(readFileSync(join(dir, "casual-0000-b.json"), "utf8")).score).toBeNull();
    const manifestPath = join(dir, "casual-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.cpu = "different machine";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const mismatch = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/calibration/worker.ts", "casual", dir, "0"],
      { encoding: "utf8" },
    );
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("Worker manifest mismatch");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
