import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildDataset, digest, SPLIT_SEED } from "./core";
import type { RosterGame } from "../roster-history/corpus";
const target = process.argv[2];
if (!target) throw Error("Usage: node --import tsx scripts/engine-bench/freeze.ts NEW_DIRECTORY");
const sources = [
  "docs/verification/roster/spassky-games.json",
  "docs/verification/roster/tal-games.json",
  "docs/verification/roster/fischer-games.json",
  "docs/verification/chigorin/corpus-games.json",
];
// Limit by content hash before replay (not source order or engine result).
const games = sources
  .flatMap((path) => JSON.parse(readFileSync(path, "utf8")) as RosterGame[])
  .sort((a, b) => digest(a.moves.join(" ")).localeCompare(digest(b.moves.join(" "))))
  .filter((g, i, all) => i === 0 || g.moves.join(" ") !== all[i - 1].moves.join(" "))
  .slice(0, 80);
const dataset = buildDataset(games);
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
const playingFiles = [...files("src/engine"), ...files("src/book"), ...files("src/rating")].sort();
const fingerprint = Object.fromEntries(
  playingFiles.map((path) => [path, digest(readFileSync(path, "utf8"))]),
);
mkdirSync(target); // Never replace a previously frozen dataset.
const hashes: Record<string, string> = {};
for (const split of ["development", "validation"] as const) {
  const text =
    JSON.stringify(
      dataset.samples.filter((s) => s.split === split),
      null,
      2,
    ) + "\n";
  hashes[split] = digest(text);
  writeFileSync(join(target, `${split}.json`), text, { flag: "wx" });
}
writeFileSync(
  join(target, "manifest.json"),
  JSON.stringify(
    {
      schema: 1,
      splitSeed: SPLIT_SEED,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      sources: Object.fromEntries(sources.map((p) => [p, digest(readFileSync(p, "utf8"))])),
      sourceExposure:
        "Historical games already informed retained repertoires. Validation is held out from NEW tuning only, not unseen training data.",
      selectedWholeGames: games.map((g) => digest(g.moves.join(" "))),
      games: dataset.games,
      quarantinedKeys: dataset.quarantinedKeys,
      counts: {
        development: dataset.samples.filter((s) => s.split === "development").length,
        validation: dataset.samples.filter((s) => s.split === "validation").length,
      },
      partitions: hashes,
      playingFiles: fingerprint,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    target,
    games: dataset.games,
    samples: dataset.samples.length,
    quarantinedKeys: dataset.quarantinedKeys,
  }),
);
