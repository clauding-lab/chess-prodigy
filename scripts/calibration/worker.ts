import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Level } from "../../src/engine/types";
import { playMatch, verifySavedMatch, type MatchOptions } from "./match";
import { HISTORICAL_PROTOCOL, assertManifest, openingForProtocol, parseProtocol } from "./protocol";

const [levelText, directoryText, pairText, protocolText] = process.argv.slice(2);
if (!(["casual", "club", "strong"] as string[]).includes(levelText) || !directoryText)
  throw new Error("Usage: worker.ts LEVEL DIRECTORY PAIR [PROTOCOL]");
const level = levelText as Level,
  pair = Number(pairText),
  protocol = parseProtocol(protocolText),
  directory = resolve(directoryText);
if (!Number.isSafeInteger(pair) || pair < 0 || pair >= 200) throw new Error("Invalid pair");
const manifestValue: unknown = JSON.parse(
  readFileSync(join(directory, `${level}-manifest.json`), "utf8"),
);
assertManifest(manifestValue, { level, protocol });
const manifest = manifestValue,
  seed = (0x20260912 + pair * 7919) >>> 0,
  opening = openingForProtocol(protocol, seed);

for (const morphyColor of ["w", "b"] as const) {
  const file = join(directory, `${level}-${String(pair).padStart(4, "0")}-${morphyColor}.json`),
    options: MatchOptions = {
      protocol,
      opponentVersion: protocol === HISTORICAL_PROTOCOL ? 3 : 1,
      level,
      morphyColor,
      seed,
      opening,
      maxPlies: manifest.maxPlies,
    };
  if (existsSync(file)) {
    const saved: unknown = JSON.parse(readFileSync(file, "utf8"));
    verifySavedMatch(saved, options);
    continue;
  }
  const game = playMatch(options);
  verifySavedMatch(game, options);
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
      protocol,
      opponentVersion: manifest.opponent.version,
      level,
      pair,
      morphyColor,
      score: game.score,
      resultReason: game.resultReason,
      plies: game.moves.length,
      elapsedMs: game.elapsedMs,
      morphyMs: game.morphyMs,
      classicMs: game.classicMs,
    }),
  );
}
