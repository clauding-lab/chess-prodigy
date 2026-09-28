// @vitest-environment node
import { expect, it } from "vitest";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { playStrengthGame, verifyStrengthGame } from "../../scripts/engine-bench/strength-match";
import { strengthSchedule } from "../../scripts/engine-bench/strength-core";
const row = strengthSchedule("development", "tal", "casual", "tal")[0];
it("records a complete legal game from START with prior-position history and candidate-relative outcome", async () => {
  const lines = ["f3", "e5", "g4", "Qh4#"];
  const game = await playStrengthGame(row, async (position, history) => {
    const move = legalMoves(position).find(
      (m) => sanFor(position, m, applyMove(position, m)) === lines[history.length],
    )!;
    expect(history).toHaveLength(lines.indexOf(lines[history.length]));
    return { move, startupMs: 1, calculationMs: 2, detail: { kind: "test" } };
  });
  expect(game).toMatchObject({ score: 0, reason: "checkmate", moves: lines });
  expect(() => verifyStrengthGame(game, row)).not.toThrow();
  expect(() => verifyStrengthGame({ ...game, score: 1 }, row)).toThrow();
  expect(() => verifyStrengthGame({ ...game, moves: [...lines, "a3"] }, row)).toThrow();
  expect(() => verifyStrengthGame(game, { ...row, seed: row.seed + 1 })).toThrow();
});
it("records incomplete calculation as an unresolved failure, never a draw or replacement move", async () => {
  const game = await playStrengthGame(row, async () => {
    throw new Error("incomplete calculation");
  });
  expect(game).toMatchObject({
    score: null,
    reason: "decision-failure",
    moves: [],
    failure: "incomplete calculation",
  });
  expect(() => verifyStrengthGame(game, row)).not.toThrow();
  expect(() => verifyStrengthGame({ ...game, score: 0.5 }, row)).toThrow();
});
it("rejects an illegal decision and preserves the position before it", async () => {
  const game = await playStrengthGame(row, async () => ({
    move: { from: 0, to: 63 },
    startupMs: 0,
    calculationMs: 1,
    detail: {},
  }));
  expect(game).toMatchObject({ score: null, reason: "decision-failure", moves: [] });
  expect(game.failure).toMatch(/illegal/i);
});
it("rejects missing pawn-double metadata instead of corrupting en passant state", async () => {
  const game = await playStrengthGame(row, async (position) => {
    const move = legalMoves(position).find(
      (m) => sanFor(position, m, applyMove(position, m)) === "e4",
    )!;
    const malformed = { ...move };
    delete malformed.double;
    return { move: malformed, startupMs: 0, calculationMs: 1, detail: {} };
  });
  expect(game).toMatchObject({ score: null, reason: "decision-failure", moves: [] });
  expect(game.failure).toMatch(/metadata/i);
  expect(() => verifyStrengthGame(game, row)).not.toThrow();
});
