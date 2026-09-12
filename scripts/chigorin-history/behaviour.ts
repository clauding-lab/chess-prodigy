import { writeFileSync } from "node:fs";
import { format } from "prettier";
import { applyMove, fromFEN, sanFor, toFEN } from "../../src/engine/board";
import { explainChigorinMove } from "../../src/engine/chigorin";
import { chooseAiMove } from "../../src/engine/search";
import type { Position, Level } from "../../src/engine/types";
const cases = {
  development: "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
  knight: "r1bq1rk1/pp2bppp/2n2n2/2p1p3/2P1P3/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 12",
  centre: "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9",
  attack: "r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16",
  ending: "7k/7p/8/8/3P4/2N5/P7/6K1 w - - 0 30",
};
function mirror(p: Position): Position {
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
const fixed = Object.entries(cases).flatMap(([name, fen]) =>
  [fromFEN(fen), mirror(fromFEN(fen))].map((p) => {
    const decision = explainChigorinMove(p, "club", 9, 30, () => 0),
      classic = chooseAiMove(
        p,
        "club",
        [],
        () => 0,
        () => 0.5,
      );
    return {
      name,
      fen: toFEN(p),
      san: decision.result.move
        ? sanFor(p, decision.result.move, applyMove(p, decision.result.move))
        : null,
      classic: classic.move ? sanFor(p, classic.move, applyMove(p, classic.move)) : null,
      decision,
    };
  }),
);
const production = [];
for (const level of ["casual", "club", "strong"] as Level[])
  for (const name of ["knight", "attack"] as const) {
    const p = fromFEN(cases[name]),
      start = performance.now(),
      decision = explainChigorinMove(p, level, 9, 30),
      elapsedMs = performance.now() - start;
    production.push({ name, level, elapsedMs, decision });
  }
writeFileSync(
  "docs/verification/chigorin/behaviour-decisions.json",
  await format(JSON.stringify({ dateBDT: "2026-09-13", fixed, production }), { parser: "json" }),
);
console.log(
  fixed
    .map(
      (x) =>
        `${x.name} ${x.fen.split(" ")[1]}: ${x.san}, Classic ${x.classic}, depth${x.decision.depth}, loss${x.decision.neutralLoss}, ${x.decision.reason}`,
    )
    .join("\n"),
);
console.log(
  production
    .map(
      (x) =>
        `${x.name} ${x.level}: ${x.elapsedMs.toFixed(1)}ms depth${x.decision.depth} ${x.decision.reason}`,
    )
    .join("\n"),
);
