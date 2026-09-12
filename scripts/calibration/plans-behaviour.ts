import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  START,
  applyMove,
  fromFEN,
  legalMoves,
  sanFor,
  sqName,
  toFEN,
} from "../../src/engine/board";
import { explainPlannedMove } from "../../src/engine/morphy-plans";
import { chooseAiMove } from "../../src/engine/search";
import type { Move, Position, Level } from "../../src/engine/types";
import { seededRandom } from "./core";
import { machineIdentity, sourceFingerprints } from "./protocol";

// Predetermined identities/properties are retained in behaviour-protocol.md, not selected by outcome.
const fixtures = [
  ["unique-mate", "7k/8/6K1/6Q1/8/8/8/8 w - - 0 1"],
  ["free-queen", "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1"],
  ["poisoned-pawn", "3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20"],
  ["recapture", "4k3/8/8/8/8/8/3q4/3R2K1 w - - 0 20"],
  ["development", "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3"],
  ["guarded-centre", "r2qkb1r/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9"],
  ["central-break", "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9"],
  ["coordination", "r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16"],
  ["balanced-coordination", "r2q1rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16"],
  ["pinned", "4r3/8/8/8/6k1/8/4N3/4K2R w - - 0 20"],
  ["ending", "7k/7p/8/8/8/8/P7/KR6 w - - 0 30"],
] as const;
const seed = 9;
function mirror(p: Position): Position {
  return {
    ...p,
    board: p.board.map((_, i) => {
      const piece = p.board[i ^ 56];
      return piece ? (`${piece[0] === "w" ? "b" : "w"}${piece[1]}` as typeof piece) : null;
    }),
    turn: p.turn === "w" ? "b" : "w",
    castling: { K: p.castling.k, Q: p.castling.q, k: p.castling.K, q: p.castling.Q },
    ep: p.ep === null ? null : p.ep ^ 56,
  };
}
const san = (p: Position, m: Move | null) => (m ? sanFor(p, m, applyMove(p, m)) : null);
const uci = (m: Move | null) => (m ? `${sqName(m.from)}${sqName(m.to)}${m.promo ?? ""}` : null);
function observe(name: string, p: Position, level: Level, ply: number, fixed = false) {
  const start = performance.now(),
    decision = explainPlannedMove(p, level, seed, ply, fixed ? () => 0 : undefined),
    elapsedMs = performance.now() - start;
  const classicStart = performance.now(),
    classic = chooseAiMove(p, level, [], fixed ? () => 0 : undefined, seededRandom(seed)),
    classicElapsedMs = performance.now() - classicStart;
  return {
    name,
    fen: toFEN(p),
    level,
    ply,
    seed,
    clock: fixed ? "fixed-depth" : "real",
    chosen: san(p, decision.result.move),
    uci: uci(decision.result.move),
    classic: san(p, classic.move),
    classicUci: uci(classic.move),
    differsFromClassic: uci(decision.result.move) !== uci(classic.move),
    elapsedMs,
    classicElapsedMs,
    ...decision,
  };
}
const directory = resolve(process.argv[2] ?? "docs/verification/morphy-plans");
mkdirSync(directory, { recursive: true });
// Warm-up uses production policy, no hidden deeper search or altered production budgets.
explainPlannedMove(START(), "casual", seed, 0);
const decisions: ReturnType<typeof observe>[] = [];
for (const level of ["casual", "club", "strong"] as const) {
  for (const [name, fen] of fixtures)
    for (const p of [fromFEN(fen), mirror(fromFEN(fen))])
      decisions.push(observe(name, p, level, 30));
  console.log(JSON.stringify({ completedLevel: level, positions: fixtures.length * 2 }));
}
const traces = [];
for (const [name, replies] of [
  ["development", ["a6", "d6"]],
  ["central-break", ["exd4"]],
  ["coordination", ["fxe6"]],
] as const) {
  const fen = fixtures.find(([id]) => id === name)![1];
  // Freeze actual base-colour response identities, then reflect moves for the Black trace.
  let white = fromFEN(fen),
    black = mirror(white);
  const turns = [];
  for (let step = 0; step <= replies.length; step++) {
    const w = observe(name, white, "club", 30 + step * 2, true),
      b = observe(name, black, "club", 30 + step * 2, true);
    turns.push({ white: w, black: b });
    if (step === replies.length) break;
    white = applyMove(white, w.result.move!);
    black = applyMove(black, b.result.move!);
    const reply = legalMoves(white).find((m) => san(white, m) === replies[step]);
    if (!reply) throw new Error(`Predetermined ${name} reply ${replies[step]} is not legal`);
    const reflected = legalMoves(black).find(
      (m) => m.from === (reply.from ^ 56) && m.to === (reply.to ^ 56) && m.promo === reply.promo,
    );
    if (!reflected) throw new Error(`Colour-reflected ${name} reply diverged`);
    white = applyMove(white, reply);
    black = applyMove(black, reflected);
  }
  traces.push({ name, replies, turns });
}
const byLevel = Object.fromEntries(
  (["casual", "club", "strong"] as const).map((level) => {
    const rows = decisions.filter((d) => d.level === level),
      reasons = Object.fromEntries(
        [...new Set(rows.map((d) => d.reason))].map((reason) => [
          reason,
          rows.filter((d) => d.reason === reason).length,
        ]),
      );
    return [
      level,
      {
        positions: rows.length,
        reasons,
        searchTimeouts: rows.filter((d) => d.searchTimedOut).length,
        deadlineFallbacks: rows.filter((d) => d.reason === "deadline" || d.reason === "incomplete")
          .length,
        changedFromClassic: rows.filter((d) => d.differsFromClassic).length,
        maximumNeutralLoss: Math.max(...rows.map((d) => d.neutralLoss)),
        maximumElapsedMs: Math.max(...rows.map((d) => d.elapsedMs)),
      },
    ];
  }),
);
const report = {
  protocol: "morphy-plans-behaviour-v1",
  dateBDT: "12 September 2026",
  machine: machineIdentity(),
  source: sourceFingerprints(),
  limits: "Production budgets; 30ms reserved inside each move budget",
  claim:
    "Engineering checks and descriptive decisions only; neither strength calibration nor a perceived-style pass",
  byLevel,
  decisions,
  traces,
};
writeFileSync(join(directory, "behaviour.json"), JSON.stringify(report, null, 2) + "\n");
const rows = decisions.map(
  (d) =>
    `| ${d.name} | ${d.fen.split(" ")[1]} | ${d.level} | ${d.chosen} | ${d.classic} | ${d.plan.mode} | ${d.depth} | ${d.progress?.bonus ?? 0} | ${d.neutralLoss} | ${d.reason} | ${d.elapsedMs.toFixed(1)} |`,
);
writeFileSync(
  join(directory, "behaviour-report.md"),
  `# Plans-v1 production decision diagnostic — 12 September 2026 BDT\n\nThese are engineering observations, not measured strength or a perceived-style certification.\nClassic comparisons use the same position/level and seed9; timings are machine dependent.\nFull terms, fingerprints, both-colour multi-turn traces and fallback totals are in behaviour.json.\n\n\`\`\`json\n${JSON.stringify(byLevel, null, 2)}\n\`\`\`\n\n| Position | Side | Level | Plans move | Classic move | Mode | Depth | Bonus cp | Neutral loss cp | Reason | ms |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
);
console.log(JSON.stringify(byLevel, null, 2));
