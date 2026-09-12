import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { cpus, arch, platform } from "node:os";
import { resolve, join } from "node:path";
import { ENGINE_ELO } from "../../src/rating/fide";
import { LEVEL_CFG } from "../../src/engine/search";
import type { Level, Color } from "../../src/engine/types";
import { START, applyMove, legalMoves, sanFor, toFEN, posKey } from "../../src/engine/board";
import { estimate, sampleOpening, terminalScore, type Score } from "./core";
import { playMatch, type MatchOptions } from "./match";

const [levelText, directoryText, pairText = "50", limitText = "1000"] = process.argv.slice(2);
if (!["casual", "club", "strong"].includes(levelText) || !directoryText)
  throw new Error("Usage: run.ts LEVEL DIRECTORY [PAIRS=50] [MAX_PLIES=1000]");
const level = levelText as Level,
  pairCount = Number(pairText),
  maxPlies = Number(limitText),
  directory = resolve(directoryText);
if (
  !Number.isSafeInteger(pairCount) ||
  pairCount < 1 ||
  pairCount > 200 ||
  !Number.isSafeInteger(maxPlies) ||
  maxPlies < 1 ||
  maxPlies > 1000
)
  throw new Error("Invalid run bounds");
mkdirSync(directory, { recursive: true });
const files = [
  "src/engine/board.ts",
  "src/engine/eval.ts",
  "src/engine/search.ts",
  "src/engine/morphy.ts",
  "src/engine/opponents.ts",
  "src/engine/types.ts",
  "src/book/lines.ts",
  "src/book/book.ts",
  "src/rating/fide.ts",
  "scripts/calibration/core.ts",
  "scripts/calibration/match.ts",
  "scripts/calibration/run.ts",
  "scripts/calibration/worker.ts",
];
const fingerprint = Object.fromEntries(
  files.map((file) => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]),
);
const manifest = {
  protocol: "morphy-paired-v1",
  level,
  maxPlies,
  anchor: ENGINE_ELO[level],
  settings: LEVEL_CFG[level],
  node: process.version,
  arch: arch(),
  platform: platform(),
  cpu: cpus()[0].model,
  source: fingerprint,
};
const manifestPath = join(directory, `${level}-manifest.json`);
if (existsSync(manifestPath)) {
  if (JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8"))) !== JSON.stringify(manifest))
    throw new Error("Resume manifest mismatch; preserve results and use a separate run directory");
} else writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
const pairs: [Score | null, Score | null][] = [];
function verifySaved(game: ReturnType<typeof playMatch>, options: MatchOptions) {
  for (const key of Object.keys(options) as (keyof MatchOptions)[])
    if (JSON.stringify(game[key]) !== JSON.stringify(options[key]))
      throw new Error("Saved match identity mismatch");
  if (!Array.isArray(game.moves) || game.moves.length > maxPlies)
    throw new Error("Invalid saved moves");
  let p = START();
  const keys = new Map([[posKey(p), 1]]);
  for (let i = 0; i < game.moves.length; i++) {
    if (terminalScore(p, keys) !== null) throw new Error("Moves after game end");
    if (i < options.opening.length && game.moves[i] !== options.opening[i])
      throw new Error("Opening mismatch");
    const m = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === game.moves[i]);
    if (!m) throw new Error("Illegal saved match");
    p = applyMove(p, m);
    const key = posKey(p);
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  const white = terminalScore(p, keys),
    score = white === null ? null : options.morphyColor === "w" ? white : 1 - white;
  if (
    game.fen !== toFEN(p) ||
    game.score !== score ||
    game.terminal !== (white !== null) ||
    (white === null && game.moves.length !== maxPlies)
  )
    throw new Error("Saved result mismatch");
}
for (let pair = 0; pair < pairCount; pair++) {
  const seed = (0x20260912 + pair * 7919) >>> 0;
  const opening = sampleOpening(seed);
  const results: [Score | null, Score | null] = [null, null];
  for (const [index, color] of (["w", "b"] as Color[]).entries()) {
    const options: MatchOptions = { level, morphyColor: color, seed, opening, maxPlies };
    const path = join(directory, `${level}-${String(pair).padStart(4, "0")}-${color}.json`);
    let game: ReturnType<typeof playMatch>;
    if (existsSync(path)) {
      game = JSON.parse(readFileSync(path, "utf8"));
      verifySaved(game, options);
    } else {
      game = playMatch(options);
      verifySaved(game, options);
      const temp = path + `.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(game) + "\n", { flag: "wx" });
      renameSync(temp, path);
    }
    results[index] = game.score;
  }
  pairs.push(results);
  const summary = {
    ...estimate(pairs, ENGINE_ELO[level]),
    level,
    pairs: pairs.length,
    wins: pairs.flat().filter((s) => s === 1).length,
    draws: pairs.flat().filter((s) => s === 0.5).length,
    losses: pairs.flat().filter((s) => s === 0).length,
  };
  writeFileSync(join(directory, `${level}-summary.json`), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
}
