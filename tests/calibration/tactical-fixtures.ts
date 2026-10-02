import { fromFEN, legalMoves, START, toFEN } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { EXPERIMENT_POLICY } from "../../src/engine/next/roster";
import { nextHistoryIdentity } from "../../src/worker/next/protocol";
import {
  createTacticalManifest,
  sha256,
  type TacticalManifest,
  type TacticalTask,
} from "../../scripts/engine-bench/tactical-manifest";
export const raw = JSON.stringify([
  { id: "sample", gameId: "source", history: [], fen: toFEN(START()) },
]);
export const settings = {
  purpose: "development" as const,
  datasetSha: sha256(raw),
  expectedCount: 1,
  context: "a".repeat(64),
  nonce: "b".repeat(64),
};
export const manifest = () => createTacticalManifest(raw, settings);
export function evidence(m: TacticalManifest, task: TacticalTask) {
  const sample = m.samples[task.sample],
    moves = legalMoves(fromFEN(sample.FEN)),
    move = moves[0];
  const common = { position: sample.FEN, history: nextHistoryIdentity(sample.priorFens) };
  if (task.kind === "reference")
    return {
      startupMs: 1,
      calculationMs: 2,
      detail: {
        ...common,
        policy: "next-neutral-v1",
        perspective: "white",
        kind: "completed",
        terminal: null,
        interruption: null,
        depth: task.depth,
        attemptedDepth: task.depth,
        phase: "forcing",
        move,
        score: 0,
        nodes: 10,
        elapsedMs: 0,
        settings: {
          maxDepth: task.depth,
          forcingCapturePlies: 4,
          forcingSafetyPlies: 12,
          baselineOnly: false,
        },
        iterations: Array.from({ length: task.depth }, (_, i) => ({
          phase: i === 0 ? "baseline" : "forcing",
          depth: i === 0 ? 2 : i + 1,
          nodes: i === task.depth - 1 ? 10 : i,
        })),
        candidates: moves.map((move) => ({ move, score: 0, kind: "exact", depth: task.depth })),
      },
    };
  return {
    startupMs: 1,
    calculationMs: 2,
    move,
    detail:
      task.side === "baseline"
        ? { move, book: false, score: 0 }
        : {
            ...common,
            policy: EXPERIMENT_POLICY,
            opponent: experimentalRosterConfig(task.opponent, task.seed),
            kind: "book",
            book: true,
            move,
            score: null,
            plan: null,
            neutralLoss: null,
            search: null,
            sourceCount: 1,
            elapsedMs: 1,
          },
  };
}
