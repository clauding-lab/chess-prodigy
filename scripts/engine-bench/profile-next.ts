import { readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { START, applyMove, legalMoves, sanFor, toFEN } from "../../src/engine/board";
import { searchNext } from "../../src/engine/next/search";
import { searchNextOrdered } from "../../src/engine/next/ordered-search";
import { searchNextCached } from "../../src/engine/next/cached-search";
import { digest, type Sample } from "./core";

// Reuses only the already declared E0 development cohort. No validation input or tuning option.
const dataset = "docs/verification/engine-improvement/e0-dataset-v1";
const cohort =
  "docs/verification/engine-improvement/e0-development12-production-isolated-v1/run-manifest.json";
const [output, variant = "reference"] = process.argv.slice(2);
if (!output) throw new Error("Usage: profile-next.ts NEW_OUTPUT_JSON [reference|ordered|cached]");
if (variant !== "reference" && variant !== "ordered" && variant !== "cached")
  throw new Error("Unknown profile variant");
const search =
  variant === "cached" ? searchNextCached : variant === "ordered" ? searchNextOrdered : searchNext;
const raw = readFileSync(`${dataset}/development.json`, "utf8");
const manifestRaw = readFileSync(`${dataset}/manifest.json`, "utf8");
const manifest = JSON.parse(manifestRaw);
if (digest(raw) !== manifest.partitions.development) throw new Error("Development dataset changed");
const cohortRaw = readFileSync(cohort, "utf8");
const cohortManifest = JSON.parse(cohortRaw);
if (
  cohortManifest.developmentHash !== digest(raw) ||
  // E0's runner fingerprints the parsed manifest using compact JSON serialization.
  cohortManifest.datasetManifestHash !== digest(JSON.stringify(manifest))
)
  throw new Error("Frozen cohort dataset changed");
const selected: unknown = cohortManifest.samples;
if (
  !Array.isArray(selected) ||
  selected.length !== 12 ||
  !selected.every((id): id is string => typeof id === "string" && id.length > 0) ||
  new Set(selected).size !== 12
)
  throw new Error("Invalid development cohort");
const samples = JSON.parse(raw) as Sample[];
const sourceFiles = [
  "src/engine/next/search.ts",
  "src/engine/next/ordered-search.ts",
  "src/engine/next/cached-search.ts",
  "src/engine/board.ts",
  "src/engine/eval.ts",
  "src/engine/rules-v2.ts",
  "scripts/engine-bench/profile-next.ts",
];
const source = Object.fromEntries(
  sourceFiles.map((path) => [path, digest(readFileSync(path, "utf8"))]),
);
const rows = [];
for (const id of selected) {
  const sample = samples.find((sample) => sample.id === id);
  if (!sample || sample.split !== "development") throw new Error("Invalid development cohort");
  let position = START();
  const prior: string[] = [];
  const replayStarted = performance.now();
  for (const san of sample.history) {
    prior.push(toFEN(position));
    const move = legalMoves(position).find(
      (move) => sanFor(position, move, applyMove(position, move)) === san,
    );
    if (!move) throw new Error(`Illegal source history: ${id}`);
    position = applyMove(position, move);
  }
  if (toFEN(position) !== sample.fen) throw new Error(`Source position mismatch: ${id}`);
  const replayMs = performance.now() - replayStarted;
  for (const [level, ms] of [
    ["casual", 200],
    ["club", 600],
    ["strong", 2000],
  ] as const) {
    const started = performance.now();
    const result = search(position, prior, { maxDepth: 8, ms });
    const wallMs = performance.now() - started;
    if (
      result.move &&
      !legalMoves(position).some((move) => JSON.stringify(move) === JSON.stringify(result.move))
    )
      throw new Error("Illegal profile result");
    rows.push({ id, level, ms, replayMs, wallMs, result });
  }
}
writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      purpose: "development-profile-only",
      variant,
      source,
      datasetHash: digest(raw),
      cohortHash: digest(cohortRaw),
      node: process.version,
      cpu: cpus()[0]?.model,
      platform: platform(),
      arch: arch(),
      timing:
        "Direct Node elapsed search, excluding result verification, no workers/books/personality; maximum depth8 at all budgets. SAN replay separately measured. Fixed Casual→Club→Strong order without separate warm-up may favor later levels through JIT/cache warming. Not strength or physical-device evidence.",
      rows,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    decisions: rows.length,
    complete: rows.filter((row) => row.result.kind === "completed").length,
  }),
);
