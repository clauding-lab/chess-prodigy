import { fromFEN, legalMoves } from "../../src/engine/board";
import type { Move } from "../../src/engine/types";
import type { NextSearchResult } from "../../src/engine/next/search";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { isExperimentResult } from "../../src/worker/next/experiment-protocol";
import { nextHistoryIdentity } from "../../src/worker/next/protocol";
import { sha256, type TacticalManifest, type TacticalTask } from "./tactical-manifest";
import {
  clusteredFailureInterval,
  sharedTacticalFailure,
  tacticalFlags,
  type FailureCluster,
} from "./tactical-protocol";
export interface TacticalOutput {
  startupMs: number;
  calculationMs: number;
  move?: Move;
  detail: unknown;
}
export interface TacticalRecord {
  key: string;
  output: unknown;
}
const moveKey = (m: Move) =>
  JSON.stringify([m.from, m.to, m.promo, m.capture, m.ep, m.double, m.castle]);
const natural = (n: number) => Number.isSafeInteger(n) && n >= 0;
type Reference = Extract<NextSearchResult, { kind: "completed" }>;
export function validateTacticalEvidence(
  m: TacticalManifest,
  task: TacticalTask,
  value: unknown,
): asserts value is TacticalOutput {
  const output = value as TacticalOutput;
  const invalid = () => {
    throw new Error(`Invalid tactical evidence: ${task.key}`);
  };
  if (
    !output ||
    ![output.startupMs, output.calculationMs].every((n) => Number.isFinite(n) && n >= 0) ||
    output.startupMs + output.calculationMs > (task.kind === "reference" ? 120000 : 15000)
  )
    invalid();
  const sample = m.samples[task.sample],
    position = fromFEN(sample.FEN),
    moves = legalMoves(position);
  const legal = new Set(moves.map(moveKey));
  if (task.kind === "reference") {
    const r = output.detail as Reference;
    if (
      !r ||
      r.kind !== "completed" ||
      r.policy !== "next-neutral-v1" ||
      r.position !== sample.FEN ||
      r.history !== nextHistoryIdentity(sample.priorFens) ||
      r.perspective !== "white" ||
      r.terminal !== null ||
      r.interruption !== null ||
      r.phase !== "forcing" ||
      r.depth !== task.depth ||
      r.attemptedDepth !== task.depth ||
      !natural(r.nodes) ||
      r.nodes > 10000000 ||
      r.elapsedMs !== 0 ||
      !Number.isFinite(r.score) ||
      r.settings?.maxDepth !== task.depth ||
      r.settings?.forcingCapturePlies !== 4 ||
      r.settings?.forcingSafetyPlies !== 12 ||
      r.settings?.baselineOnly !== false ||
      !Array.isArray(r.candidates) ||
      r.candidates.length !== moves.length ||
      !Array.isArray(r.iterations) ||
      r.iterations.length !== task.depth
    )
      invalid();
    const seen = new Set<string>(),
      sign = position.turn === "w" ? 1 : -1;
    for (const entry of r.candidates) {
      const key = moveKey(entry.move);
      if (
        !legal.has(key) ||
        seen.has(key) ||
        entry.kind !== "exact" ||
        entry.depth !== task.depth ||
        !Number.isFinite(entry.score) ||
        entry.score * sign > r.score * sign
      )
        invalid();
      seen.add(key);
    }
    if (
      !r.candidates.some((c) => moveKey(c.move) === moveKey(r.move) && c.score === r.score) ||
      !r.iterations.every(
        (entry, i) =>
          entry.phase === (i === 0 ? "baseline" : "forcing") &&
          entry.depth === (i === 0 ? 2 : i + 1) &&
          natural(entry.nodes) &&
          entry.nodes <= r.nodes &&
          (i === 0 || entry.nodes >= r.iterations[i - 1].nodes),
      ) ||
      r.iterations.at(-1)!.nodes !== r.nodes
    )
      invalid();
  } else {
    if (!output.move || !legal.has(moveKey(output.move))) invalid();
    const detail = output.detail as { move: Move; book: boolean; score: number | null };
    if (!detail?.move || moveKey(detail.move) !== moveKey(output.move!)) invalid();
    if (task.side === "candidate") {
      if (
        !isExperimentResult(detail, {
          requestId: sample.history.length + 1,
          gameId: task.key,
          revision: sample.history.length,
          position,
          history: sample.priorFens,
          level: task.level,
          opponent: experimentalRosterConfig(task.opponent, task.seed),
          turnDeadline: null,
        })
      )
        invalid();
    } else if (
      typeof detail.book !== "boolean" ||
      (detail.book ? detail.score !== null : !Number.isFinite(detail.score))
    )
      invalid();
  }
}
export function assembleTacticalReport(m: TacticalManifest, records: readonly TacticalRecord[]) {
  if (
    records.length !== m.tasks.length ||
    new Set(records.map((r) => r.key)).size !== records.length
  )
    throw new Error("Incomplete or duplicate evidence");
  const byKey = new Map(records.map((r) => [r.key, r.output]));
  for (const task of m.tasks) validateTacticalEvidence(m, task, byKey.get(task.key));
  const reference = (sample: number, depth: number) =>
    (byKey.get(`reference-${sample}-${depth}`) as TacticalOutput).detail as Reference;
  const canonicalMove = (sample: number, move: Move) =>
    legalMoves(fromFEN(m.samples[sample].FEN)).find((c) => moveKey(c) === moveKey(move))!;
  const classify = (task: Extract<TacticalTask, { kind: "decision" }>) => {
    const output = byKey.get(task.key) as TacticalOutput,
      sign = fromFEN(m.samples[task.sample].FEN).turn === "w" ? 1 : -1;
    const score = (depth: number) => {
      const r = reference(task.sample, depth);
      const pair: [number, number] = [
        r.score * sign,
        r.candidates.find((c) => moveKey(c.move) === moveKey(output.move!))!.score * sign,
      ];
      return { best: pair[0], selected: pair[1], flags: tacticalFlags(...pair) };
    };
    const depth3 = score(3),
      depth4 = score(4);
    return {
      move: canonicalMove(task.sample, output.move!),
      depth3,
      depth4,
      failure: sharedTacticalFailure(
        [depth3.best, depth3.selected],
        [depth4.best, depth4.selected],
      ),
    };
  };
  const decisions = m.tasks.filter((t) => t.kind === "decision");
  const comparisons = decisions
    .filter((t) => t.side === "candidate")
    .map((t) => {
      const baseline = decisions.find(
        (b) =>
          b.sample === t.sample &&
          b.opponent === t.opponent &&
          b.level === t.level &&
          b.seed === t.seed &&
          b.side === "baseline",
      )!;
      return { task: t, candidate: classify(t), baseline: classify(baseline) };
    });
  const groups = (["tal", "fischer"] as const).flatMap((opponent) =>
    (["club", "strong"] as const).map((level) => {
      const clusters = new Map<string, FailureCluster>();
      for (const row of comparisons.filter(
        (r) => r.task.opponent === opponent && r.task.level === level,
      )) {
        const gameId = m.samples[row.task.sample].gameId;
        const c = clusters.get(gameId) ?? {
          gameId,
          decisions: 0,
          candidateFailures: 0,
          baselineFailures: 0,
        };
        c.decisions++;
        c.candidateFailures += Number(row.candidate.failure);
        c.baselineFailures += Number(row.baseline.failure);
        clusters.set(gameId, c);
      }
      const interval = clusteredFailureInterval([...clusters.values()]);
      return {
        opponent,
        level,
        interval,
        statisticalCriterion:
          level === "club"
            ? interval.difference < 0 && interval.upper < 0
            : interval.difference <= 0 && interval.upper <= 0,
      };
    }),
  );
  const privateMapping: { id: string; task: string; candidateLabel: "A" | "B" }[] = [];
  const review = comparisons
    .map((row) => {
      const id = sha256(`${m.settings.nonce}:${row.task.key}`),
        swap = parseInt(id.slice(0, 2), 16) % 2 === 1;
      privateMapping.push({ id, task: row.task.key, candidateLabel: swap ? "B" : "A" });
      const s = m.samples[row.task.sample];
      return {
        id,
        FEN: s.FEN,
        history: s.history,
        references: [3, 4].map((depth) => {
          const r = reference(row.task.sample, depth);
          return {
            depth,
            perspective: "white",
            score: r.score,
            candidates: r.candidates.map((c) => ({
              move: canonicalMove(row.task.sample, c.move),
              score: c.score,
              kind: c.kind,
              depth: c.depth,
            })),
          };
        }),
        A: swap ? row.baseline : row.candidate,
        B: swap ? row.candidate : row.baseline,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    qualification: false as const,
    status: "awaiting-independent-and-other-gates" as const,
    groups,
    review,
    privateMapping,
  };
}
