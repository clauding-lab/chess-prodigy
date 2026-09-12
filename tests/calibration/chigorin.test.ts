import { expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseProtocol,
  opponentIdentity,
  openingForProtocol,
} from "../../scripts/calibration/protocol";

test("Chigorin measurement selects its own identity from the normal starting position", () => {
  const protocol = parseProtocol("chigorin-plans-paired-v1");
  expect(opponentIdentity(protocol)).toEqual({
    id: "chigorin",
    version: 1,
    engine: "chigorin-plans-v1",
    randomPolicy: "seeded-per-ply-v1",
  });
  expect(openingForProtocol(protocol, 123)).toEqual([]);
});

test("Chigorin matches reject Morphy identities and forced openings", async () => {
  const { playMatch, verifySavedMatch } = await import("../../scripts/calibration/match");
  const protocol = parseProtocol("chigorin-plans-paired-v1");
  const options = {
    protocol,
    opponentVersion: 1 as const,
    level: "casual" as const,
    morphyColor: "w" as const,
    seed: 1,
    opening: [],
    maxPlies: 1,
  };
  const game = playMatch(options);
  expect(game.opponent.id).toBe("chigorin");
  expect(game.moves).toHaveLength(1);
  expect(game.score).toBeNull();
  expect(() => verifySavedMatch(game, options)).not.toThrow();
  expect(() => playMatch({ ...options, opponentVersion: 4 })).toThrow(/protocol.*version/i);
  expect(() => playMatch({ ...options, opening: ["e4"] })).toThrow(/start.*opening/i);
  expect(() =>
    verifySavedMatch(
      { ...game, opponent: { ...game.opponent, id: "attack-development" } },
      options,
    ),
  ).toThrow(/identity/i);
});

test("Chigorin worker binds book and policy fingerprints and preserves completed games", () => {
  const dir = mkdtempSync(join(tmpdir(), "chigorin-worker-"));
  const run = (script: string, args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", script, ...args], { encoding: "utf8" });
  try {
    const init = run("scripts/calibration/run.ts", [
      "casual",
      dir,
      "1",
      "1",
      "chigorin-plans-paired-v1",
      "--init-only",
    ]);
    expect(init.status, init.stderr).toBe(0);
    const file = join(dir, "casual-manifest.json");
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    expect(manifest.opponent.id).toBe("chigorin");
    expect(manifest.source["src/engine/chigorin.ts"]).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.source["src/engine/chigorin-book.ts"]).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.source["src/book/chigorin-book.json"]).toMatch(/^[a-f0-9]{64}$/);
    const worker = () =>
      run("scripts/calibration/worker.ts", ["casual", dir, "0", "chigorin-plans-paired-v1"]);
    const first = worker();
    expect(first.status, first.stderr).toBe(0);
    const gamePath = join(dir, "casual-0000-w.json"),
      before = readFileSync(gamePath, "utf8");
    expect(JSON.parse(before).opponent.id).toBe("chigorin");
    expect(worker().status).toBe(0);
    expect(readFileSync(gamePath, "utf8")).toBe(before);
    manifest.source["src/book/chigorin-book.json"] = "a".repeat(64);
    writeFileSync(file, JSON.stringify(manifest));
    const changed = worker();
    expect(changed.status).not.toBe(0);
    expect(changed.stderr).toContain("source fingerprint mismatch");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20000);
