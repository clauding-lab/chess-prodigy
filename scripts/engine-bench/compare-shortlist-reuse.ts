import { readFileSync, writeFileSync } from "node:fs";
import { START, applyMove, legalMoves, sanFor, toFEN } from "../../src/engine/board";
import { searchNext } from "../../src/engine/next/search";
import { searchNextShortlistReuse } from "../../src/engine/next/shortlist-reuse-search";
import { digest, type Sample } from "./core";

const [output] = process.argv.slice(2);
if (!output) throw new Error("Usage: compare-shortlist-reuse.ts NEW_OUTPUT_JSON");
const dataset = "docs/verification/engine-improvement/e0-dataset-v1";
const raw = readFileSync(`${dataset}/development.json`, "utf8");
const manifest = JSON.parse(readFileSync(`${dataset}/manifest.json`, "utf8"));
const cohortRaw = readFileSync(
  "docs/verification/engine-improvement/e0-development12-production-isolated-v1/run-manifest.json",
  "utf8",
);
const cohort = JSON.parse(cohortRaw);
if (
  digest(raw) !== manifest.partitions.development ||
  digest(raw) !== cohort.developmentHash ||
  digest(JSON.stringify(manifest)) !== cohort.datasetManifestHash ||
  !Array.isArray(cohort.samples) ||
  cohort.samples.length !== 12 ||
  !cohort.samples.every((id: unknown) => typeof id === "string") ||
  new Set(cohort.samples).size !== 12
)
  throw new Error("Frozen development cohort changed");
const samples = JSON.parse(raw) as Sample[];
const rows = [];
for (const id of cohort.samples as string[]) {
  const sample = samples.find((sample) => sample.id === id && sample.split === "development");
  if (!sample) throw new Error("Missing development sample");
  let position = START();
  const prior: string[] = [];
  for (const san of sample.history) {
    prior.push(toFEN(position));
    const move = legalMoves(position).find(
      (move) => sanFor(position, move, applyMove(position, move)) === san,
    );
    if (!move) throw new Error("Illegal source history");
    position = applyMove(position, move);
  }
  if (toFEN(position) !== sample.fen) throw new Error("Source position mismatch");
  const options = { maxDepth: 3, ms: 1, now: () => 0, maxNodes: 5_000_000 };
  const reference = searchNext(position, prior, options);
  const candidate = searchNextShortlistReuse(position, prior, {
    ...options,
    candidateWindowCp: 100,
  });
  const complete = (result: typeof reference | typeof candidate) =>
    result.kind === "completed" &&
    result.phase === "forcing" &&
    result.depth === 3 &&
    result.interruption === null;
  const scores = (result: typeof reference | typeof candidate) =>
    result.candidates
      .map(({ move, score, kind }) => ({ key: JSON.stringify(move), score, kind }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const comparable = complete(reference) && complete(candidate);
  const sign = position.turn === "w" ? 1 : -1;
  const equal = comparable
    ? candidate.score === reference.score &&
      candidate.candidates.length === reference.candidates.length &&
      new Set(candidate.candidates.map((entry) => JSON.stringify(entry.move))).size ===
        reference.candidates.length &&
      candidate.candidates.every((entry) => {
        const exact = reference.candidates.find(
          (value) => JSON.stringify(value.move) === JSON.stringify(entry.move),
        );
        if (!exact) return false;
        return entry.kind === "exact"
          ? entry.score === exact.score
          : entry.kind === (sign === 1 ? "upper-bound" : "lower-bound") &&
              exact.score * sign <= entry.score * sign &&
              entry.score * sign < candidate.score! * sign - 100;
      }) &&
      candidate.candidates.some(
        (entry) =>
          entry.kind === "exact" &&
          entry.score === candidate.score &&
          JSON.stringify(entry.move) === JSON.stringify(candidate.move),
      )
    : null;
  rows.push({
    id,
    comparable,
    equal,
    reference: {
      nodes: reference.nodes,
      depth: reference.depth,
      phase: reference.phase,
      interruption: reference.interruption,
      move: reference.move,
      score: reference.score,
      scores: scores(reference),
    },
    candidate: {
      nodes: candidate.nodes,
      depth: candidate.depth,
      phase: candidate.phase,
      interruption: candidate.interruption,
      move: candidate.move,
      score: candidate.score,
      scores: scores(candidate),
    },
  });
}
const source = Object.fromEntries(
  [
    "src/engine/next/search.ts",
    "src/engine/next/shortlist-reuse-search.ts",
    "src/engine/board.ts",
    "src/engine/eval.ts",
    "src/engine/rules-v2.ts",
    "scripts/engine-bench/compare-shortlist-reuse.ts",
  ].map((file) => [file, digest(readFileSync(file, "utf8"))]),
);
writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      purpose: "fixed-depth-shortlist-reuse-bound-comparison",
      cohortHash: digest(cohortRaw),
      developmentHash: digest(raw),
      source,
      node: process.version,
      settings: {
        candidateWindowCp: 100,
        maxDepth: 3,
        maxNodes: 5_000_000,
        clock: "constant-zero; not timing evidence",
        forcingSafetyPlies: 12,
      },
      rows,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const mismatches = rows.filter((row) => row.equal === false).length;
console.log(
  JSON.stringify({ output, comparable: rows.filter((row) => row.comparable).length, mismatches }),
);
if (mismatches || rows.some((row) => !row.comparable)) process.exitCode = 1;
