import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LEVEL_CFG } from "../../src/engine/search";
import type { Color, Level } from "../../src/engine/types";
import { ENGINE_ELO } from "../../src/rating/fide";
import { estimate, type Score } from "./core";
import { playMatch, verifySavedMatch, type MatchOptions, type MatchResult } from "./match";
import {
  HISTORICAL_PROTOCOL,
  LEGACY_PROTOCOL,
  assertManifest,
  machineIdentity,
  openingForProtocol,
  opponentIdentity,
  parseProtocol,
  sourceFingerprints,
  type CalibrationManifest,
} from "./protocol";

const [levelText, directoryText, pairText = "50", limitText = "1000", ...selectors] =
  process.argv.slice(2);
if (!(["casual", "club", "strong"] as string[]).includes(levelText) || !directoryText)
  throw new Error(
    "Usage: run.ts LEVEL DIRECTORY [PAIRS=50] [MAX_PLIES=1000] [PROTOCOL] [--init-only|--verify-only] [--concurrency=N]",
  );
const protocolSelectors = selectors.filter((value) => !value.startsWith("--"));
if (protocolSelectors.length > 1) throw new Error("Only one calibration protocol may be selected");
const protocol = parseProtocol(protocolSelectors[0]),
  flags = selectors.filter((value) => value.startsWith("--")),
  modes = flags.filter((value) => value === "--init-only" || value === "--verify-only"),
  concurrencyValues = flags.filter((value) => value.startsWith("--concurrency="));
if (
  modes.length > 1 ||
  concurrencyValues.length > 1 ||
  flags.some(
    (value) =>
      value !== "--init-only" && value !== "--verify-only" && !value.startsWith("--concurrency="),
  )
)
  throw new Error("Invalid calibration run mode");
const mode = modes[0] ?? "run",
  concurrency = Number(concurrencyValues[0]?.slice("--concurrency=".length) ?? "1"),
  level = levelText as Level,
  pairCount = Number(pairText),
  maxPlies = Number(limitText),
  directory = resolve(directoryText),
  machine = machineIdentity();
if (
  !Number.isSafeInteger(pairCount) ||
  pairCount < 1 ||
  pairCount > 200 ||
  !Number.isSafeInteger(maxPlies) ||
  maxPlies < 1 ||
  maxPlies > 1000 ||
  !Number.isSafeInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > machine.cpuCount
)
  throw new Error("Invalid run bounds or concurrency");
mkdirSync(directory, { recursive: true });

const manifest: CalibrationManifest = {
  schemaVersion: 2,
  protocol,
  opponent: opponentIdentity(protocol),
  classic: {
    id: "classic",
    version: 1,
    engine: "classic-v1",
    randomPolicy: "seeded-match-stream-v1",
    book: "production-book-v1",
  },
  level,
  maxPlies,
  anchor: ENGINE_ELO[level],
  productionSettings: { classic: LEVEL_CFG[level], morphy: LEVEL_CFG[level] },
  openingPolicy: protocol === HISTORICAL_PROTOCOL ? "start-position-v1" : "sampled-six-ply-v1",
  pairSeedPolicy: "color-swapped-20260912-v1",
  adjudication: "none",
  checkpoints: [50, 100, 200],
  interval: { method: "approximate-pair-wilson-v1", z: 2.4, maximumWidth: 300 },
  ...machine,
  concurrency,
  source: sourceFingerprints(),
};
const manifestPath = join(directory, `${level}-manifest.json`);
if (existsSync(manifestPath)) {
  const saved: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  assertManifest(saved, { level, protocol });
  if (JSON.stringify(saved) !== JSON.stringify(manifest))
    throw new Error("Resume manifest mismatch; preserve results and use a separate run directory");
} else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });

if (mode === "--init-only") {
  console.log(JSON.stringify({ initialized: true, level, protocol, manifest: manifestPath }));
} else {
  const pairs: [Score | null, Score | null][] = [];
  for (let pair = 0; pair < pairCount; pair++) {
    const seed = (0x20260912 + pair * 7919) >>> 0,
      opening = openingForProtocol(protocol, seed),
      results: [Score | null, Score | null] = [null, null];
    for (const [index, color] of (["w", "b"] as Color[]).entries()) {
      const options: MatchOptions = {
        protocol,
        opponentVersion: protocol === HISTORICAL_PROTOCOL ? 3 : 1,
        level,
        morphyColor: color,
        seed,
        opening,
        maxPlies,
      };
      const path = join(directory, `${level}-${String(pair).padStart(4, "0")}-${color}.json`);
      let game: MatchResult;
      if (existsSync(path)) {
        const saved: unknown = JSON.parse(readFileSync(path, "utf8"));
        verifySavedMatch(saved, options);
        game = saved;
      } else {
        if (mode === "--verify-only") throw new Error(`Verification requires saved match: ${path}`);
        game = playMatch(options);
        verifySavedMatch(game, options);
        const temp = path + `.${process.pid}.tmp`;
        writeFileSync(temp, JSON.stringify(game) + "\n", { flag: "wx" });
        renameSync(temp, path);
      }
      verifySavedMatch(game, options);
      results[index] = game.score;
    }
    pairs.push(results);
    const measured = estimate(pairs, ENGINE_ELO[level]),
      summary = {
        ...measured,
        eligible:
          measured.eligible &&
          (protocol === LEGACY_PROTOCOL || (protocol === HISTORICAL_PROTOCOL && maxPlies === 1000)),
        protocol,
        opponentVersion: manifest.opponent.version,
        level,
        pairs: pairs.length,
        wins: pairs.flat().filter((score) => score === 1).length,
        draws: pairs.flat().filter((score) => score === 0.5).length,
        losses: pairs.flat().filter((score) => score === 0).length,
      };
    writeFileSync(
      join(directory, `${level}-summary.json`),
      JSON.stringify(summary, null, 2) + "\n",
    );
    console.log(JSON.stringify(summary));
  }
}
