import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import { join } from "node:path";
import { pairedInterval, strengthSchedule, type StrengthRow } from "./strength-core";
import {
  playStrengthGame,
  STRENGTH_MAX_PLIES,
  verifyStrengthGame,
  type StrengthGame,
} from "./strength-match";
import { buildStrengthWorkers, workerChooser } from "./strength-worker";
import { EXPERIMENT_BUDGETS, EXPERIMENT_LOSS } from "../../src/engine/next/roster";
import type { ExperimentId } from "../../src/engine/next/plans";
import type { Level } from "../../src/engine/types";
import type { Score } from "../calibration/core";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const files = (path: string): string[] =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)],
  );
const fingerprints = () =>
  Object.fromEntries(
    [
      ...files("src"),
      ...files("scripts/engine-bench"),
      "scripts/calibration/core.ts",
      "package.json",
      "package-lock.json",
      "docs/superpowers/specs/2026-09-29-strength-protocol.md",
    ]
      .sort()
      .map((path) => [path, digest(readFileSync(path))]),
  );
const machine = () => ({
  node: process.version,
  arch: arch(),
  platform: platform(),
  cpu: cpus()[0].model,
  cpuCount: cpus().length,
});
const write = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const settings = () => ({
  failureEvidenceVersion: 1,
  budgets: EXPERIMENT_BUDGETS,
  loss: EXPERIMENT_LOSS,
  maxDepth: 8,
  forcingCapturePlies: 4,
  forcingSafetyPlies: 12,
  candidateWindowCp: 100,
  rankingReserveMs: 30,
  maxPlies: STRENGTH_MAX_PLIES,
  workerCapacityMs: 15000,
  lifecycle: "fresh-node-thread-per-ply-no-warmup",
  adjudication: "production-terminal-only",
  stopOnFailure: true,
});
const [command, directory, id, level] = process.argv.slice(2);
if (!directory || !["freeze", "run"].includes(command))
  throw new Error(
    "Usage: strength-run.ts freeze NEW_DIRECTORY tal|fischer casual|club|strong OR run DIRECTORY",
  );
if (command === "freeze") {
  const schedule = strengthSchedule(
    "development",
    id as ExperimentId,
    level as Level,
    id as ExperimentId,
  );
  const source = fingerprints();
  const bundles = buildStrengthWorkers();
  if (JSON.stringify(source) !== JSON.stringify(fingerprints()))
    throw new Error("Source changed while building frozen workers");
  mkdirSync(directory); // An existing run is never replaced.
  for (const [name, source] of Object.entries(bundles))
    writeFileSync(join(directory, `${name}.cjs`), source, { flag: "wx" });
  write(join(directory, "manifest.json"), {
    purpose: "development-only",
    protocol: "coherent-strength-v1",
    createdAt: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source,
    machine: machine(),
    settings: settings(),
    bundles: Object.fromEntries(
      Object.entries(bundles).map(([name, source]) => [name, digest(source)]),
    ),
    schedule,
  });
  console.log(
    `Frozen development schedule: ${schedule.length} games; no validation or rating qualification.`,
  );
} else {
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  if (JSON.stringify(manifest.settings) !== JSON.stringify(settings()))
    throw new Error("Frozen settings mismatch");
  if (
    manifest.purpose !== "development-only" ||
    manifest.protocol !== "coherent-strength-v1" ||
    JSON.stringify(manifest.source) !== JSON.stringify(fingerprints()) ||
    JSON.stringify(manifest.machine) !== JSON.stringify(machine())
  )
    throw new Error("Frozen source or machine mismatch");
  const first = manifest.schedule?.[0] as StrengthRow | undefined;
  if (
    !first ||
    JSON.stringify(manifest.schedule) !==
      JSON.stringify(strengthSchedule("development", first.candidate, first.level, first.baseline))
  )
    throw new Error("Schedule mismatch");
  const bundles = Object.fromEntries(
    ["experiment", "tal", "fischer"].map((name) => {
      const source = readFileSync(join(directory, `${name}.cjs`), "utf8");
      if (digest(source) !== manifest.bundles[name]) throw new Error("Worker bundle mismatch");
      return [name, source];
    }),
  ) as ReturnType<typeof buildStrengthWorkers>;
  const games: StrengthGame[] = [];
  for (const row of manifest.schedule as StrengthRow[]) {
    if (JSON.stringify(manifest.source) !== JSON.stringify(fingerprints()))
      throw new Error("Source drift during run");
    const resultPath = join(directory, `${row.key}.json`),
      startedPath = join(directory, `${row.key}.started.json`);
    let game: StrengthGame;
    if (existsSync(resultPath)) {
      const value: unknown = JSON.parse(readFileSync(resultPath, "utf8"));
      verifyStrengthGame(value, row);
      game = value;
    } else {
      if (existsSync(startedPath))
        throw new Error(`Unresolved prior attempt: ${row.key}. Do not rerun or replace its seed.`);
      write(startedPath, { row, startedAt: new Date().toISOString() });
      game = await playStrengthGame(row, workerChooser(row, bundles));
      verifyStrengthGame(game, row);
      write(resultPath, game);
      console.log(
        JSON.stringify({
          key: row.key,
          score: game.score,
          reason: game.reason,
          plies: game.moves.length,
          elapsedMs: game.elapsedMs,
        }),
      );
    }
    games.push(game);
    if (game.score === null)
      throw new Error(`Development blocked by ${row.key}: ${game.reason} ${game.failure ?? ""}`);
  }
  const pairs = Array.from(
    { length: 20 },
    (_, n) => [games[n * 2].score, games[n * 2 + 1].score] as [Score, Score],
  );
  write(join(directory, "summary.json"), {
    purpose: "development-only",
    qualification: false,
    interval: pairedInterval(pairs),
    games: games.length,
    statement: "Exploratory strength evidence; no rating, style, phone or validation acceptance.",
  });
}
