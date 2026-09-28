import { expect, it } from "vitest";
import { fromFEN } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { decideExperiment } from "../../src/engine/next/roster";
import {
  isExperimentResult,
  type ExperimentRequest,
} from "../../src/worker/next/experiment-protocol";
const input = (): ExperimentRequest => ({
  requestId: 1,
  gameId: "experiment",
  revision: 0,
  position: fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1"),
  history: [],
  level: "club",
  opponent: experimentalRosterConfig("tal", 11),
  turnDeadline: null,
});
it("validates the chosen move separately from unchanged exact neutral-best evidence", () => {
  const r = input(),
    value = decideExperiment(
      r.position,
      r.history,
      r.opponent,
      r.level,
      {},
      { now: () => 0, maxNodes: 10000 },
    );
  expect(value.kind).toBe("move");
  expect(isExperimentResult(value, r)).toBe(true);
  expect(
    isExperimentResult({ ...value, opponent: experimentalRosterConfig("fischer", 11) }, r),
  ).toBe(false);
  expect(isExperimentResult({ ...value, neutralLoss: 101 }, r)).toBe(false);
  const bound = value.search!.candidates.find((c) => c.kind !== "exact")!;
  expect(bound).toBeDefined();
  expect(isExperimentResult({ ...value, move: bound.move, score: bound.score }, r)).toBe(false);
  expect(
    isExperimentResult(
      { ...value, plan: { id: "invented", targetFile: 0, sincePly: 0, epoch: 0 } },
      r,
    ),
  ).toBe(false);
});
it("preserves explicit incompletion and rejects attempts to label it playable", () => {
  const r = input(),
    value = decideExperiment(
      r.position,
      r.history,
      r.opponent,
      r.level,
      {},
      { now: () => 0, remainingMs: 0 },
    );
  expect(isExperimentResult(value, r)).toBe(true);
  expect(isExperimentResult({ ...value, kind: "move" }, r)).toBe(false);
});
it("rejects a book claim on a drawn board that still has legal moves", async () => {
  const { toFEN, legalMoves } = await import("../../src/engine/board");
  const { nextHistoryIdentity } = await import("../../src/worker/next/protocol");
  const r = input();
  r.position.halfmove = 100;
  const value = {
    policy: "coherent-roster-v1",
    opponent: r.opponent,
    position: toFEN(r.position),
    history: nextHistoryIdentity([]),
    kind: "book",
    move: legalMoves(r.position)[0],
    score: null,
    book: true,
    plan: null,
    neutralLoss: null,
    sourceCount: 2,
    search: null,
    elapsedMs: 0,
  };
  expect(isExperimentResult(value, r)).toBe(false);
});
