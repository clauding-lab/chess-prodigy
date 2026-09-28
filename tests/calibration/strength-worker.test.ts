// @vitest-environment node
import { expect, it } from "vitest";
import { START, applyMove, legalMoves, sameMove, toFEN } from "../../src/engine/board";
import { strengthSchedule } from "../../scripts/engine-bench/strength-core";
import { buildStrengthWorkers, workerChooser } from "../../scripts/engine-bench/strength-worker";

it("executes both real worker entries in fresh threads and preserves experimental provenance", async () => {
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const choose = workerChooser(row, buildStrengthWorkers());
  const start = START();
  const candidate = await choose(start, [], [], true);
  expect(legalMoves(start).some((move) => sameMove(move, candidate.move))).toBe(true);
  expect(candidate.detail).toMatchObject({
    kind: "book",
    policy: "coherent-roster-v1",
    opponent: { id: "tal", version: 2 },
  });
  expect(candidate.startupMs).toBeGreaterThan(0);
  expect(candidate.calculationMs).toBeGreaterThan(0);
  const after = applyMove(start, candidate.move);
  const baseline = await choose(after, [toFEN(start)], ["fixture-ply"], false);
  expect(legalMoves(after).some((move) => sameMove(move, baseline.move))).toBe(true);
  expect(baseline.startupMs).toBeGreaterThan(0);
  expect(baseline.calculationMs).toBeGreaterThan(0);
}, 10000);
