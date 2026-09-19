import { writeFileSync } from "node:fs";
import { applyMove, fromFEN, legalMoves, sanFor, toFEN } from "../../src/engine/board";
import { explainSpasskyMove } from "../../src/engine/roster/spassky";
import { explainTalMove } from "../../src/engine/roster/tal";
import { explainFischerMove } from "../../src/engine/roster/fischer";
import { features, offeredMaterial } from "../../src/engine/roster/features";
import type { Position, Level } from "../../src/engine/types";
export const cases = {
  buildup: "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
  centre: "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9",
  attack: "r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16",
  sacrifice: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8",
  trap: "3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20",
  pressure: "r2q1rk1/pp3ppp/2n1bn2/2p1p3/2P1P3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12",
  conversion: "6k1/5ppp/8/3P4/4K3/8/5PPP/8 w - - 0 30",
};
export function mirror(p: Position): Position {
  return {
    ...p,
    board: p.board.map((_, i) => {
      const x = p.board[i ^ 56];
      return x ? (`${x[0] === "w" ? "b" : "w"}${x[1]}` as typeof x) : null;
    }),
    turn: p.turn === "w" ? "b" : "w",
    castling: { K: p.castling.k, Q: p.castling.q, k: p.castling.K, q: p.castling.Q },
    ep: p.ep === null ? null : p.ep ^ 56,
  };
}
const engines = { spassky: explainSpasskyMove, tal: explainTalMove, fischer: explainFischerMove };
const fixed = [];
for (const [name, fen] of Object.entries(cases))
  for (const p of [fromFEN(fen), mirror(fromFEN(fen))])
    for (const [id, engine] of Object.entries(engines)) {
      const decision = engine(p, "club", 9, 30, () => 0),
        m = decision.result.move!;
      const record = {
        name,
        id,
        fen: toFEN(p),
        san: sanFor(p, m, applyMove(p, m)),
        offered: offeredMaterial(p, m),
        decision,
        before: features(p, p.turn),
        after: features(applyMove(p, m), p.turn),
      };
      fixed.push(record);
      console.log(
        `${name} ${p.turn} ${id}: ${record.san}, loss${decision.neutralLoss}, bonus${decision.bonus}, ${decision.plan}, offer${record.offered}`,
      );
    }
const production = [];
for (const [id, engine] of Object.entries(engines))
  for (const level of ["casual", "club", "strong"] as Level[]) {
    const p = fromFEN(cases.pressure),
      start = performance.now(),
      decision = engine(p, level, 9, 30);
    production.push({ id, level, elapsedMs: performance.now() - start, decision });
  }
writeFileSync(
  "docs/verification/roster/behaviour-decisions.json",
  JSON.stringify({ dateBDT: "2026-09-19", fixed, production }, null, 2) + "\n",
);

// Actual multi-turn records include reply choices; they do not claim human perceived style.
const sequences = [];
const lines = [
  { id: "spassky", fen: cases.buildup, reply: "a6" },
  { id: "spassky", fen: cases.centre, reply: "exd4" },
  { id: "tal", fen: "3q1rk1/pp3ppp/5n2/3p4/7Q/3B4/PPP1p1PP/5RK1 w - - 0 20", reply: "gxf6" },
  { id: "fischer", fen: cases.pressure, reply: "Re8" },
  { id: "fischer", fen: cases.conversion, reply: "Kf8" },
] as const;
for (const line of lines)
  for (const reflected of [false, true]) {
    const original = fromFEN(line.fen),
      p = reflected ? mirror(original) : original;
    const first = engines[line.id](p, "club", 9, 30, () => 0),
      m = first.result.move!,
      after = applyMove(p, m);
    const originalDecision = engines[line.id](original, "club", 9, 30, () => 0),
      originalAfter = applyMove(original, originalDecision.result.move!);
    const originalReply = legalMoves(originalAfter).find(
      (r) => sanFor(originalAfter, r, applyMove(originalAfter, r)) === line.reply,
    )!;
    const reply = legalMoves(after).find(
      (r) =>
        r.from === (reflected ? originalReply.from ^ 56 : originalReply.from) &&
        r.to === (reflected ? originalReply.to ^ 56 : originalReply.to),
    )!;
    const continued = applyMove(after, reply),
      second = engines[line.id](continued, "club", 9, 32, () => 0);
    sequences.push({
      id: line.id,
      fen: toFEN(p),
      first: first,
      firstSan: sanFor(p, m, after),
      offered: offeredMaterial(p, m),
      reply: sanFor(after, reply, continued),
      second,
      secondSan: sanFor(continued, second.result.move!, applyMove(continued, second.result.move!)),
      alternatives: Object.fromEntries(
        Object.entries(engines).map(([id, fn]) => {
          const d = fn(p, "club", 9, 30, () => 0);
          return [
            id,
            { san: sanFor(p, d.result.move!, applyMove(p, d.result.move!)), decision: d },
          ];
        }),
      ),
    });
  }
const speculativeProduction = [];
for (const reflected of [false, true])
  for (const level of ["casual", "club", "strong"] as Level[]) {
    const base = fromFEN(lines[2].fen),
      p = reflected ? mirror(base) : base,
      start = performance.now(),
      decision = explainTalMove(p, level, 9, 30);
    speculativeProduction.push({
      side: p.turn,
      level,
      elapsedMs: performance.now() - start,
      san: sanFor(p, decision.result.move!, applyMove(p, decision.result.move!)),
      decision,
    });
  }
writeFileSync(
  "docs/verification/roster/behaviour-sequences.json",
  JSON.stringify({ dateBDT: "2026-09-19", sequences, speculativeProduction }, null, 2) + "\n",
);
