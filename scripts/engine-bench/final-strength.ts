import { START, applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { toFEN } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { isExperimentResult } from "../../src/worker/next/experiment-protocol";
import type { Move } from "../../src/engine/types";
import { strengthSeed, type StrengthRow, pairedInterval } from "./strength-core";
import { verifyStrengthGame, type StrengthGame } from "./strength-match";
import type { Score } from "../calibration/core";
export function finalStrengthSchedule(): StrengthRow[] {
  return (["tal", "fischer"] as const).flatMap((candidate) =>
    [
      { baseline: candidate, level: "strong" as const, pairs: 200 },
      { baseline: "spassky" as const, level: "strong" as const, pairs: 50 },
      { baseline: "chigorin" as const, level: "strong" as const, pairs: 50 },
      { baseline: candidate, level: "club" as const, pairs: 100 },
    ].flatMap(({ baseline, level, pairs }) =>
      Array.from({ length: pairs }, (_, pair) => {
        const label = `coherent-strength-v1:validation:${candidate}:${level}:${baseline}:${pair}`;
        return (["w", "b"] as const).map((color) => ({
          key: `${candidate}-${level}-${baseline}-${pair}-${color}`,
          candidate,
          baseline,
          level,
          pair,
          color,
          seed: strengthSeed(label),
          baselineSeed: strengthSeed(`${label}:baseline:${baseline}`),
        }));
      }).flat(),
    ),
  );
}
const key = (m: Move) =>
  JSON.stringify([m.from, m.to, m.promo, m.capture, m.ep, m.double, m.castle]);
export function verifyFinalGame(value: unknown, row: StrengthRow): asserts value is StrengthGame {
  verifyStrengthGame(value, row);
  if (value.score === null) throw new Error("Unresolved final game blocks qualification");
  let p = START();
  const history: string[] = [];
  for (let ply = 0; ply < value.moves.length; ply++) {
    const move = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === value.moves[ply])!;
    const d = value.decisions[ply],
      detail = d.detail as { move: Move; book: boolean; score: number | null };
    if (d.startupMs + d.calculationMs > 15000 || !detail?.move || key(detail.move) !== key(move))
      throw new Error("Invalid final decision");
    if (p.turn === row.color) {
      if (
        !isExperimentResult(detail, {
          requestId: ply + 1,
          gameId: row.key,
          revision: ply,
          position: p,
          history,
          level: row.level,
          opponent: experimentalRosterConfig(row.candidate, row.seed),
          turnDeadline: null,
        })
      )
        throw new Error("Invalid candidate provenance");
    } else if (
      typeof detail.book !== "boolean" ||
      (detail.book ? detail.score !== null : !Number.isFinite(detail.score))
    )
      throw new Error("Invalid baseline detail");
    history.push(toFEN(p));
    p = applyMove(p, move);
  }
}
export function finalStrengthReport(games: readonly StrengthGame[]) {
  const rows = finalStrengthSchedule();
  if (games.length !== rows.length || new Set(games.map((g) => g.row.key)).size !== rows.length)
    throw new Error("Incomplete final schedule");
  const byKey = new Map(games.map((g) => [g.row.key, g]));
  for (const row of rows) verifyFinalGame(byKey.get(row.key), row);
  const groups = [...new Set(rows.map((r) => `${r.candidate}:${r.level}:${r.baseline}`))].map(
    (id) => {
      const selected = rows.filter((r) => `${r.candidate}:${r.level}:${r.baseline}` === id);
      const pairs = Array.from(
        { length: selected.length / 2 },
        (_, i) =>
          [byKey.get(selected[i * 2].key)!.score!, byKey.get(selected[i * 2 + 1].key)!.score!] as [
            Score,
            Score,
          ],
      );
      const interval = pairedInterval(pairs),
        first = selected[0];
      return {
        candidate: first.candidate,
        baseline: first.baseline,
        level: first.level,
        games: selected.length,
        interval,
        statisticalCriterion:
          first.baseline !== first.candidate
            ? null
            : first.level === "strong"
              ? interval.mean > 0.5 && interval.lower > 0.5
              : interval.mean >= 0.5 && interval.lower >= 0.45,
      };
    },
  );
  return { qualification: false as const, groups };
}
