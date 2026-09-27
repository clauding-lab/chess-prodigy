import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cpus, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { applyMove, fromFEN, legalMoves, sameMove, sqName } from "../../src/engine/board";
import { bookLookup } from "../../src/book/book";
import { chooseAiMove, searchRootCandidates, LEVEL_CFG } from "../../src/engine/search";
import { explainPlannedMove } from "../../src/engine/morphy-plans";
import { explainChigorinMove } from "../../src/engine/chigorin";
import { explainSpasskyMove } from "../../src/engine/roster/spassky";
import { explainTalMove } from "../../src/engine/roster/tal";
import { explainFischerMove } from "../../src/engine/roster/fischer";
import {
  CLASSIC,
  plannedMorphyConfig,
  chigorinConfig,
  rosterConfig,
} from "../../src/engine/opponents";
import { seededRandom } from "../calibration/core";
import {
  agreement,
  assertMode,
  classifyChoice,
  digest,
  SEEDS,
  type Sample,
  type AgreementRow,
} from "./core";
import { selectSamples } from "./selection";
import type { Level, Move } from "../../src/engine/types";
const [datasetDir, outputDir, mode = "production-elapsed", countText = "1", cohort = "all"] =
  process.argv.slice(2);
if (!datasetDir || !outputDir)
  throw Error("Usage: run.ts DATASET NEW_OUTPUT MODE SAMPLES_PER_COLOR [all|offbook]");
assertMode(mode);
const count = Number(countText);
if (!Number.isSafeInteger(count) || count < 1) throw Error("Invalid sample count");
// Validation has no execution path in the development runner. A separately reviewed
// future validation runner must explicitly consume that partition after candidate freeze.
const manifest = JSON.parse(readFileSync(join(datasetDir, "manifest.json"), "utf8"));
for (const [path, hash] of Object.entries(manifest.playingFiles))
  if (digest(readFileSync(path, "utf8")) !== hash)
    throw Error(`Frozen playing source changed: ${path}`);
const source = readFileSync(join(datasetDir, "development.json"), "utf8");
if (digest(source) !== manifest.partitions.development) throw Error("Dataset fingerprint mismatch");
const samples = JSON.parse(source) as Sample[];
const selected = selectSamples(samples, count, cohort);
mkdirSync(outputDir);
writeFileSync(
  join(outputDir, "run-manifest.json"),
  JSON.stringify(
    {
      schema: 1,
      mode,
      cohort,
      harnessHashes: Object.fromEntries(
        readdirSync("scripts/engine-bench")
          .filter((p) => p.endsWith(".ts"))
          .map((p) => [p, digest(readFileSync(join("scripts/engine-bench", p), "utf8"))]),
      ),
      datasetManifestHash: digest(JSON.stringify(manifest)),
      developmentHash: digest(source),
      samples: selected.map((s) => s.id),
      seeds: SEEDS.development,
      node: process.version,
      cpu: cpus()[0]?.model,
      platform: platform(),
      arch: arch(),
      levels: LEVEL_CFG,
      clockSemantics:
        mode === "production-elapsed"
          ? "performance.now(), untouched production budgets including ranking"
          : "constant zero: complete configured policy search; no wall time limit, no node budget, NOT production timing",
      workerStartupMs: null,
      workerStartupNote: "Direct Node calls; browser worker startup not measured",
      telemetry:
        "No fabricated visited-node counts. Classic depth/timeout and roster timeout are unavailable through existing APIs.",
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const uci = (m: Move) => `${sqName(m.from)}${sqName(m.to)}${m.promo ?? ""}`;
const rows: (AgreementRow & Record<string, unknown>)[] = [];
for (const sample of selected) {
  const p = fromFEN(sample.fen),
    legal = legalMoves(p);
  const review = searchRootCandidates(p, 2, Number.MAX_SAFE_INTEGER, () => 0);
  const choice = classifyChoice(
    legal.length,
    review.candidates.map((c) => c.score),
    review.depth,
  );
  const best = Math.max(...review.candidates.map((c) => c.score));
  for (const level of ["casual", "club", "strong"] as Level[])
    for (const seed of SEEDS.development) {
      const now = mode === "production-elapsed" ? () => performance.now() : () => 0;
      for (const opponent of [
        "classic",
        "morphy",
        "chigorin",
        "spassky",
        "tal",
        "fischer",
      ] as const) {
        const started = performance.now();
        const explained =
          opponent === "morphy"
            ? explainPlannedMove(p, level, seed, sample.ply, now)
            : opponent === "chigorin"
              ? explainChigorinMove(p, level, seed, sample.ply, now)
              : opponent === "spassky"
                ? explainSpasskyMove(p, level, seed, sample.ply, now)
                : opponent === "tal"
                  ? explainTalMove(p, level, seed, sample.ply, now)
                  : opponent === "fischer"
                    ? explainFischerMove(p, level, seed, sample.ply, now)
                    : null;
        const result =
          explained?.result ??
          chooseAiMove(p, level, bookLookup(sample.history).replies, now, seededRandom(seed));
        const elapsedMs = performance.now() - started;
        if (!result.move || !legal.some((m) => sameMove(m, result.move!)))
          throw Error(`Illegal benchmark move: ${sample.id}/${opponent}`);
        const reviewed = review.candidates.find((c) => sameMove(c.move, result.move!));
        const row = {
          sampleId: sample.id,
          gameId: sample.gameId,
          color: p.turn,
          level,
          seed,
          mode,
          opponent,
          configuration:
            opponent === "classic"
              ? CLASSIC
              : opponent === "morphy"
                ? plannedMorphyConfig(seed)
                : opponent === "chigorin"
                  ? chigorinConfig(seed)
                  : rosterConfig(opponent, seed),
          move: uci(result.move),
          choice,
          book: result.book,
          elapsedMs,
          achievedDepth: explained?.depth ?? null,
          visitedPositions: null,
          searchTimedOut:
            explained && "searchTimedOut" in explained ? explained.searchTimedOut : null,
          incompleteComparison: explained ? explained.reason === "incomplete" : null,
          reason: explained?.reason ?? (result.book ? "book" : "unavailable"),
          selectedPlan: explained?.plan ?? null,
          neutralReview: {
            depth: review.depth,
            lossCp: reviewed ? best - reviewed.score : null,
            perspective: "mover",
            independentEngine: false,
          },
          resultingPositionHasLegalMoves: legalMoves(applyMove(p, result.move)).length > 0,
        };
        rows.push(row);
        writeFileSync(
          join(outputDir, `cell-${rows.length.toString().padStart(5, "0")}.json`),
          JSON.stringify(row) + "\n",
          { flag: "wx" },
        );
        console.log(
          `${rows.length}/${selected.length * 36} ${mode} ${opponent} ${level} ${p.turn} ${Math.round(elapsedMs)}ms`,
        );
      }
    }
}
const byLevel = Object.fromEntries(
  (["casual", "club", "strong"] as const).map((level) => [
    level,
    agreement(rows.filter((r) => r.level === level)),
  ]),
);
const variety = Object.fromEntries(
  ["classic", "morphy", "chigorin", "spassky", "tal", "fischer"].map((opponent) => {
    const grouped = selected.flatMap((s) =>
      ["casual", "club", "strong"].map((level) =>
        rows.filter((r) => r.opponent === opponent && r.sampleId === s.id && r.level === level),
      ),
    );
    return [
      opponent,
      {
        cells: grouped.length,
        cellsWithSeedVariation: grouped.filter((g) => new Set(g.map((r) => r.move)).size > 1)
          .length,
      },
    ];
  }),
);
writeFileSync(
  join(outputDir, "summary.json"),
  JSON.stringify(
    {
      schema: 1,
      mode,
      cohort,
      complete: true,
      decisions: rows.length,
      strength: {
        status: "not-measured",
        note: "Position choices do not establish playing strength; no complete-game tournament run.",
      },
      tacticalReliability: {
        status: "shallow-proxy-only",
        neutralReviewDepth: 2,
        maximumLossCp: Math.max(
          ...rows.map((r) => (r.neutralReview as { lossCp: number | null }).lossCp ?? 0),
        ),
        note: "Same frozen neutral search; not deeper independent tactical adjudication.",
      },
      variety,
      personality: {
        full: agreement(rows),
        byLevel,
        ownerComparison: "pending-E3",
        multiMoveCoherence: "not-measured",
        note: "Descriptive agreement, not proof of recognizable style; small cells are correlated, no independent-sample confidence claim.",
      },
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
