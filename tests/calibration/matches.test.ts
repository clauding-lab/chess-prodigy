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
  expect(game.resultReason).toBe("checkmate");
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
  expect(game.resultReason).toBe("unresolved-ply-bound");
  expect(game.moves).toEqual(["e4", "e5"]);
});

test("historical protocol starts from START and selects the version-3 production policy", async () => {
  const { playMatch } = await import("../../scripts/calibration/match");
  const game = playMatch({
    protocol: "morphy-historical-paired-v1",
    opponentVersion: 3,
    level: "casual",
    morphyColor: "w",
    seed: 1,
    opening: [],
    maxPlies: 1,
  });
  expect(game.opening).toEqual([]);
  expect(game.moves).toEqual(["e4"]);
  expect(game.opponent).toEqual({
    id: "attack-development",
    version: 3,
    engine: "historical-v1",
    randomPolicy: "seeded-per-ply-v1",
    seed: 1,
  });
});

test("match identity rejects unsupported protocol and opponent-version combinations", async () => {
  const { playMatch } = await import("../../scripts/calibration/match");
  expect(() =>
    playMatch({
      protocol: "morphy-historical-paired-v1",
      opponentVersion: 1,
      level: "casual",
      morphyColor: "w",
      seed: 1,
      opening: [],
      maxPlies: 1,
    }),
  ).toThrow(/protocol.*version/i);
  expect(() =>
    playMatch({
      protocol: "morphy-historical-paired-v1",
      opponentVersion: 3,
      level: "casual",
      morphyColor: "w",
      seed: 1,
      opening: ["e4"],
      maxPlies: 1,
    }),
  ).toThrow(/start.*opening/i);
  expect(() =>
    playMatch({
      protocol: "future-v9",
      opponentVersion: 3,
      level: "casual",
      morphyColor: "w",
      seed: 1,
      opening: [],
      maxPlies: 1,
    } as unknown as Parameters<typeof playMatch>[0]),
  ).toThrow(/unsupported.*protocol/i);
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
    const game = JSON.parse(readFileSync(join(dir, "casual-0000-w.json"), "utf8"));
    expect(game.protocol).toBe("morphy-paired-v1");
    expect(game.opponentVersion).toBe(1);
    expect(game.opponent.engine).toBe("style-v1");
    expect(game.opening).toHaveLength(6);
    expect(game.moves).toEqual(game.opening.slice(0, 2));
    expect(summary.unresolved).toBe(2);
    expect(summary.eligible).toBe(false);
    expect(run("3").status).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("historical runner initializes an exact version-3 manifest without starting games", async () => {
  const { existsSync, mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-historical-init-test-"));
  try {
    const initialized = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/calibration/run.ts",
        "casual",
        dir,
        "1",
        "1",
        "morphy-historical-paired-v1",
        "--init-only",
      ],
      { encoding: "utf8" },
    );
    expect(initialized.status, initialized.stderr).toBe(0);
    expect(existsSync(join(dir, "casual-0000-w.json"))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(dir, "casual-manifest.json"), "utf8"));
    expect(manifest.protocol).toBe("morphy-historical-paired-v1");
    expect(manifest.opponent).toEqual({
      id: "attack-development",
      version: 3,
      engine: "historical-v1",
      randomPolicy: "seeded-per-ply-v1",
    });
    expect(manifest.classic).toEqual({
      id: "classic",
      version: 1,
      engine: "classic-v1",
      randomPolicy: "seeded-match-stream-v1",
      book: "production-book-v1",
    });
    expect(manifest.productionSettings).toEqual({
      classic: { depth: 1, ms: 200, noise: 120, book: 0.5 },
      morphy: { depth: 1, ms: 200, noise: 120, book: 0.5 },
    });
    expect(Object.keys(manifest.source).sort()).toEqual(
      [
        "docs/verification/morphy-history/training.json",
        "package-lock.json",
        "package.json",
        "scripts/calibration/core.ts",
        "scripts/calibration/match.ts",
        "scripts/calibration/protocol.ts",
        "scripts/calibration/run.ts",
        "scripts/calibration/worker.ts",
        "scripts/morphy-history/corpus.ts",
        "scripts/morphy-history/import.ts",
        "scripts/morphy-history/train.ts",
        "src/book/book.ts",
        "src/book/lines.ts",
        "src/book/morphy-book.json",
        "src/book/morphy-games.json",
        "src/engine/board.ts",
        "src/engine/eval.ts",
        "src/engine/historical-features.ts",
        "src/engine/historical-morphy.ts",
        "src/engine/morphy-model.json",
        "src/engine/morphy.ts",
        "src/engine/opponents.ts",
        "src/engine/search.ts",
        "src/engine/types.ts",
        "src/rating/fide.ts",
        "tsconfig.json",
        "tsconfig.server.json",
      ].sort(),
    );
    expect(
      Object.values(manifest.source).every((hash) => /^[a-f0-9]{64}$/.test(String(hash))),
    ).toBe(true);
    expect(manifest.source["src/engine/morphy-model.json"]).toBe(
      "bcac472c15613f704ec1069c2089951312321a6f43ff2e33f0c50d69621cefc3",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("verify-only refuses missing games and does not silently create them", async () => {
  const { existsSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-verify-missing-test-"));
  const args = [
    "--import",
    "tsx",
    "scripts/calibration/run.ts",
    "casual",
    dir,
    "1",
    "1",
    "morphy-historical-paired-v1",
  ];
  try {
    expect(spawnSync(process.execPath, [...args, "--init-only"], { encoding: "utf8" }).status).toBe(
      0,
    );
    const audit = spawnSync(process.execPath, [...args, "--verify-only"], { encoding: "utf8" });
    expect(audit.status).not.toBe(0);
    expect(audit.stderr).toContain("Verification requires saved match");
    expect(existsSync(join(dir, "casual-0000-w.json"))).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("verify-only rejects an illegal saved game instead of qualifying its claimed score", async () => {
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-verify-illegal-test-"));
  const args = ["--import", "tsx", "scripts/calibration/run.ts", "casual", dir, "1", "7"];
  try {
    const played = spawnSync(process.execPath, args, { encoding: "utf8" });
    expect(played.status, played.stderr).toBe(0);
    const path = join(dir, "casual-0000-w.json"),
      game = JSON.parse(readFileSync(path, "utf8"));
    game.moves[6] = "Ke7";
    game.score = 1;
    writeFileSync(path, JSON.stringify(game));
    const audit = spawnSync(process.execPath, [...args, "--verify-only"], { encoding: "utf8" });
    expect(audit.status).not.toBe(0);
    expect(audit.stderr).toContain("Illegal saved match");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("historical worker plays the declared version-3 START policy", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-historical-worker-test-"));
  const spawn = (script: string, args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", script, ...args], { encoding: "utf8" });
  try {
    const initialized = spawn("scripts/calibration/run.ts", [
      "casual",
      dir,
      "1",
      "1",
      "morphy-historical-paired-v1",
      "--init-only",
    ]);
    expect(initialized.status, initialized.stderr).toBe(0);
    const worker = spawn("scripts/calibration/worker.ts", [
      "casual",
      dir,
      "0",
      "morphy-historical-paired-v1",
    ]);
    expect(worker.status, worker.stderr).toBe(0);
    const game = JSON.parse(readFileSync(join(dir, "casual-0000-w.json"), "utf8"));
    expect(game.protocol).toBe("morphy-historical-paired-v1");
    expect(game.opponentVersion).toBe(3);
    expect(game.opponent.engine).toBe("historical-v1");
    expect(game.opening).toEqual([]);
    expect(game.moves).toEqual(["e4"]);
    expect(game.resultReason).toBe("unresolved-ply-bound");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);

test("workers reject unsupported identity and incomplete, empty, extra, or changed fingerprints", async () => {
  const { mkdtempSync, readFileSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "morphy-manifest-validation-test-"));
  const spawn = (script: string, args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", script, ...args], { encoding: "utf8" });
  try {
    const initialized = spawn("scripts/calibration/run.ts", [
      "casual",
      dir,
      "1",
      "1",
      "--init-only",
    ]);
    expect(initialized.status, initialized.stderr).toBe(0);
    const path = join(dir, "casual-manifest.json"),
      original = JSON.parse(readFileSync(path, "utf8"));
    type MutableManifest = {
      source?: Record<string, string>;
      opponent: { version: number };
      productionSettings: { classic: { ms: number } };
      cpu: string;
    };
    const cases: Array<[string, (manifest: MutableManifest) => void, string]> = [
      ["omitted source", (manifest) => delete manifest.source, "fingerprints are missing"],
      ["empty source", (manifest) => (manifest.source = {}), "fingerprint set mismatch"],
      [
        "empty hash",
        (manifest) => (manifest.source!["src/engine/morphy-model.json"] = ""),
        "fingerprint is invalid",
      ],
      [
        "extra hash",
        (manifest) => (manifest.source!["unapproved.ts"] = "a".repeat(64)),
        "fingerprint set mismatch",
      ],
      [
        "wrong version",
        (manifest) => (manifest.opponent.version = 3),
        "identity or machine mismatch",
      ],
      [
        "changed production limit",
        (manifest) => (manifest.productionSettings.classic.ms = 201),
        "identity or machine mismatch",
      ],
      [
        "wrong machine",
        (manifest) => (manifest.cpu = "different machine"),
        "identity or machine mismatch",
      ],
    ];
    for (const [name, mutate, message] of cases) {
      const manifest = structuredClone(original) as MutableManifest;
      mutate(manifest);
      writeFileSync(path, JSON.stringify(manifest));
      const worker = spawn("scripts/calibration/worker.ts", ["casual", dir, "0"]);
      expect(worker.status, name).not.toBe(0);
      expect(worker.stderr, name).toContain(message);
    }
    writeFileSync(path, JSON.stringify(original));
    const wrongProtocol = spawn("scripts/calibration/worker.ts", [
      "casual",
      dir,
      "0",
      "morphy-historical-paired-v1",
    ]);
    expect(wrongProtocol.status).not.toBe(0);
    expect(wrongProtocol.stderr).toContain("identity or machine mismatch");
    const unsupported = spawn("scripts/calibration/worker.ts", ["casual", dir, "0", "future-v9"]);
    expect(unsupported.status).not.toBe(0);
    expect(unsupported.stderr).toContain("Unsupported calibration protocol");
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
    expect(mismatch.stderr).toContain("Calibration manifest identity or machine mismatch");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
