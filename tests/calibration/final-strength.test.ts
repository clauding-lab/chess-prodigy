// @vitest-environment node
import { expect, it } from "vitest";
import { finalStrengthSchedule, verifyFinalGame } from "../../scripts/engine-bench/final-strength";
import { strengthSeed } from "../../scripts/engine-bench/strength-core";
import { playStrengthGame } from "../../scripts/engine-bench/strength-match";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { EXPERIMENT_POLICY } from "../../src/engine/next/roster";
import { nextHistoryIdentity } from "../../src/worker/next/protocol";
export async function fixtureGame(row = finalStrengthSchedule()[0]) {
  const line = ["f3", "e5", "g4", "Qh4#"];
  return playStrengthGame(row, async (p, history, moves, candidate) => {
    const move = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === line[moves.length])!;
    const { toFEN } = await import("../../src/engine/board");
    return {
      move,
      startupMs: 1,
      calculationMs: 2,
      detail: candidate
        ? {
            policy: EXPERIMENT_POLICY,
            opponent: experimentalRosterConfig(row.candidate, row.seed),
            position: toFEN(p),
            history: nextHistoryIdentity(history),
            kind: "book",
            book: true,
            move,
            score: null,
            plan: null,
            neutralLoss: null,
            search: null,
            sourceCount: 1,
            elapsedMs: 1,
          }
        : { move, book: false, score: 0 },
    };
  });
}
it("pins all 1600 registered games, eight matchups and color-swapped seeds", () => {
  const rows = finalStrengthSchedule();
  expect(rows).toHaveLength(1600);
  expect(new Set(rows.map((r) => r.key)).size).toBe(1600);
  expect(new Set(rows.map((r) => [r.candidate, r.level, r.baseline].join(":"))).size).toBe(8);
  for (let i = 0; i < rows.length; i += 2) {
    const w = rows[i],
      b = rows[i + 1];
    expect(w.color).toBe("w");
    expect(b).toEqual({ ...w, key: w.key.slice(0, -1) + "b", color: "b" });
    const label = `coherent-strength-v1:validation:${w.candidate}:${w.level}:${w.baseline}:${w.pair}`;
    expect(w.seed).toBe(strengthSeed(label));
    expect(w.baselineSeed).toBe(strengthSeed(label + `:baseline:${w.baseline}`));
  }
});
it("requires legal complete terminal games and validates every candidate and baseline decision", async () => {
  const row = finalStrengthSchedule()[0],
    game = await fixtureGame(row);
  expect(() => verifyFinalGame(game, row)).not.toThrow();
  for (const alter of [
    (g: typeof game) => {
      g.decisions[0].detail = {};
    },
    (g: typeof game) => {
      g.decisions[1].calculationMs = 15000;
    },
    (g: typeof game) => {
      g.score = null;
    },
  ]) {
    const changed = structuredClone(game);
    alter(changed);
    expect(() => verifyFinalGame(changed, row)).toThrow();
  }
});
it("requires every complete pair in its own report and never declares qualification", async () => {
  const { finalStrengthReport } = await import("../../scripts/engine-bench/final-strength");
  const games: Awaited<ReturnType<typeof fixtureGame>>[] = [];
  for (const row of finalStrengthSchedule()) games.push(await fixtureGame(row));
  const report = finalStrengthReport(games);
  expect(report.qualification).toBe(false);
  expect(report.groups.map((g) => g.games)).toEqual([400, 100, 100, 200, 400, 100, 100, 200]);
  expect(() => finalStrengthReport(games.slice(1))).toThrow();
  expect(() => finalStrengthReport([...games.slice(1), games[1]])).toThrow();
}, 30000);
