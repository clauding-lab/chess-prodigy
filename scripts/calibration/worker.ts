import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, linkSync, unlinkSync } from "node:fs";
import { cpus, arch, platform } from "node:os";
import { join, resolve } from "node:path";
import type { Level } from "../../src/engine/types";
import { sampleOpening } from "./core";
import { playMatch } from "./match";
const [levelText, directoryText, pairText] = process.argv.slice(2);
if (!["casual", "club", "strong"].includes(levelText) || !directoryText)
  throw new Error("Invalid worker arguments");
const level = levelText as Level,
  pair = Number(pairText),
  directory = resolve(directoryText);
if (!Number.isSafeInteger(pair) || pair < 0 || pair >= 200) throw new Error("Invalid pair");
const manifest = JSON.parse(readFileSync(join(directory, `${level}-manifest.json`), "utf8"));
if (
  manifest.level !== level ||
  manifest.node !== process.version ||
  manifest.arch !== arch() ||
  manifest.platform !== platform() ||
  manifest.cpu !== cpus()[0].model ||
  !Number.isSafeInteger(manifest.maxPlies) ||
  manifest.maxPlies < 1 ||
  manifest.maxPlies > 1000
)
  throw new Error("Worker manifest mismatch");
for (const [file, hash] of Object.entries(manifest.source)) {
  if (createHash("sha256").update(readFileSync(file)).digest("hex") !== hash)
    throw new Error("Worker source mismatch");
}
const seed = (0x20260912 + pair * 7919) >>> 0,
  opening = sampleOpening(seed);
for (const morphyColor of ["w", "b"] as const) {
  const file = join(directory, `${level}-${String(pair).padStart(4, "0")}-${morphyColor}.json`);
  if (existsSync(file)) continue;
  const game = playMatch({ level, morphyColor, seed, opening, maxPlies: manifest.maxPlies });
  const temp = file + `.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(game) + "\n", { flag: "wx" });
  // Hard-link publication is atomic and refuses to replace a concurrent result.
  try {
    linkSync(temp, file);
  } finally {
    unlinkSync(temp);
  }
  console.log(
    JSON.stringify({
      level,
      pair,
      morphyColor,
      score: game.score,
      plies: game.moves.length,
      elapsedMs: game.elapsedMs,
    }),
  );
}
