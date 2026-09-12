import { expect, test } from "vitest";
import { START, applyMove, fromFEN, legalMoves, sanFor, sqName } from "../../src/engine/board";
import * as plans from "../../src/engine/morphy-plans";
import { chooseOpponentMove } from "../../src/engine/morphy";
import {
  historicalMorphyConfig,
  isRatedOpponent,
  isSupportedOpponent,
  plannedMorphyConfig,
} from "../../src/engine/opponents";
import type { Move, Position } from "../../src/engine/types";
const fixed = () => 0;
const san = (p: Position, m: Move | null) => (m ? sanFor(p, m, applyMove(p, m)) : null);
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
const development = "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
const centre = "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9";
const attack = "r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16";

// These fail if the new dispatch silently falls through to an older engine or is made rated early.
test("dispatches synthetic version4 as supported, distinct and unrated", () => {
  expect(isSupportedOpponent(plannedMorphyConfig(12))).toBe(true);
  expect(isRatedOpponent(plannedMorphyConfig(12))).toBe(false);
  expect(isSupportedOpponent({ ...plannedMorphyConfig(12), engine: "historical-v1" })).toBe(false);
  const p = fromFEN(development);
  expect(chooseOpponentMove(p, "club", ["Qh5"], plannedMorphyConfig(12), 8, fixed)).toEqual(
    plans.choosePlannedMove(p, "club", 12, 8, fixed),
  );
});

test("actual choices take unique mate, free queen and recapture for both colours", () => {
  for (const [fen, want] of [
    ["7k/8/6K1/6Q1/8/8/8/8 w - - 0 1", "Qd8#"],
    ["4k3/8/8/8/8/8/q7/R3K3 w - - 0 1", "Rxa2"],
    ["4k3/8/8/8/8/8/3q4/3R2K1 w - - 0 20", "Rxd2"],
  ]) {
    const p = fromFEN(fen),
      chosen = plans.choosePlannedMove(p, "club", 1, 24, fixed);
    expect(san(p, chosen.move)).toBe(want);
    const reflected = plans.choosePlannedMove(mirror(p), "club", 1, 24, fixed);
    expect(reflected.move?.from).toBe(chosen.move!.from ^ 56);
    expect(reflected.move?.to).toBe(chosen.move!.to ^ 56);
    expect(reflected.score).toBe(-chosen.score!);
  }
});

test("rejects poisoned queen capture rather than rewarding central action", () => {
  const p = fromFEN("3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20");
  for (const position of [p, mirror(p)]) {
    const d = plans.explainPlannedMove(position, "club", 8, 40, fixed);
    expect(d.result.move?.capture).not.toBe(`${position.turn === "w" ? "b" : "w"}p`);
    expect(d.neutralLoss).toBeLessThanOrEqual(100);
  }
});

test("recomputes development, centre, coordination and ending goals for either colour", () => {
  for (const [fen, mode] of [
    [development, "develop"],
    [centre, "open-centre"],
    [attack, "king-attack"],
    ["7k/7p/8/8/8/8/P7/KR6 w - - 0 30", "active-pieces"],
  ]) {
    const p = fromFEN(fen);
    for (const q of [p, mirror(p)]) expect(plans.morphyPlan(q).mode).toBe(mode);
  }
});

test("develops successive home minor pieces and opens the centre with d4", () => {
  let p = fromFEN(development);
  for (const reply of ["a6", "d6"]) {
    const d = plans.explainPlannedMove(p, "club", 9, 8, fixed);
    expect(d.plan.mode).toBe("develop");
    expect(["b", "n"]).toContain(p.board[d.result.move!.from]?.[1]);
    expect(d.result.move!.from >> 3).toBe(7);
    expect(d.progress!.terms.development).toBeGreaterThan(0);
    p = applyMove(p, d.result.move!);
    const response = legalMoves(p).find((m) => san(p, m) === reply);
    expect(response).toBeDefined();
    p = applyMove(p, response!);
  }
  const c = fromFEN(centre),
    d = plans.explainPlannedMove(c, "club", 9, 16, fixed);
  expect(san(c, d.result.move)).toBe("d4");
  expect(d.progress!.terms.centralBreak).toBe(150);
});

test("counts legal contributing pieces, excluding the absolutely pinned knight", () => {
  const p = fromFEN("4r3/8/8/8/6k1/8/4N3/4K2R w - - 0 20");
  expect(plans.planFeatures(p, "w").attackers).toBe(1);
  expect(plans.planFeatures(fromFEN("8/8/8/8/6k1/8/4N3/4K2R w - - 0 20"), "w").attackers).toBe(2);
  const q = fromFEN(attack),
    move = legalMoves(q).find((m) => san(q, m) === "Ng5")!;
  expect(move).toBeDefined();
  const progress = plans.planProgress(q, move);
  expect(progress.terms.attackers).toBeGreaterThan(0);
  expect(progress.bonus).toBeGreaterThan(0);
  expect(
    plans.planProgress(mirror(q), { ...move, from: move.from ^ 56, to: move.to ^ 56 }),
  ).toEqual(progress);
});

test("book seeds exactly preserve version3 recorded choices independently of Classic book", () => {
  for (let seed = 0; seed < 100; seed++) {
    expect(
      chooseOpponentMove(START(), "casual", ["d4"], plannedMorphyConfig(seed), 0, fixed),
    ).toEqual(chooseOpponentMove(START(), "casual", [], historicalMorphyConfig(seed), 0, fixed));
  }
});

test("ending keeps neutral choice; expired budget never publishes partial plan rankings", () => {
  const p = fromFEN("7k/7p/8/8/8/8/P7/KR6 w - - 0 30");
  const d = plans.explainPlannedMove(p, "club", 9, 60, fixed);
  expect(d.reason).toBe("neutral");
  expect(d.neutralLoss).toBe(0);
  let ticks = 0;
  const expired = plans.explainPlannedMove(fromFEN(attack), "club", 9, 30, () => ticks++ * 100);
  expect(expired.reason).toMatch(/deadline|incomplete/);
  expect(expired.progress).toBeNull();
  expect(expired.neutralLoss).toBe(0);
  expect(legalMoves(fromFEN(attack))).toContainEqual(expired.result.move);
});

test("terminal decisions, invalid identities and deterministic offbook replay", () => {
  for (const p of [{ ...START(), halfmove: 100 }, fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")])
    expect(plans.choosePlannedMove(p, "club", 1, 0, fixed).move).toBeNull();
  expect(() => plans.choosePlannedMove(START(), "club", -1, 0, fixed)).toThrow(/seed/);
  expect(() => plans.choosePlannedMove(START(), "club", 1, -1, fixed)).toThrow(/identity/);
  const p = fromFEN(attack),
    a = plans.explainPlannedMove(p, "club", 81, 30, fixed),
    b = plans.explainPlannedMove(p, "club", 81, 30, fixed);
  expect(a).toEqual(b);
  expect(a.neutralLoss).toBeLessThanOrEqual(100);
  expect(sqName(a.result.move!.from)).toBeTypeOf("string");
});

test("central break never overrides the hanging bishop safety guard", () => {
  const p = fromFEN("r2qkb1r/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9");
  const d = plans.explainPlannedMove(p, "club", 9, 16, fixed);
  expect(san(p, d.result.move)).not.toBe("d4");
  expect(d.neutralLoss).toBeLessThanOrEqual(100);
});

test("follows a central break through an exchange and adds a second attacking piece", () => {
  for (const [fen, reply, mode] of [
    [centre, "exd4", "open-centre"],
    [attack, "fxe6", "king-attack"],
  ]) {
    let p = fromFEN(fen);
    const first = plans.explainPlannedMove(p, "club", 9, 30, fixed);
    expect(first.plan.mode).toBe(mode);
    expect(first.progress!.bonus).toBeGreaterThan(0);
    p = applyMove(p, first.result.move!);
    const response = legalMoves(p).find((m) => san(p, m) === reply);
    expect(response).toBeDefined();
    p = applyMove(p, response!);
    const second = plans.explainPlannedMove(p, "club", 9, 32, fixed);
    expect(second.plan.mode).toBe(mode);
    expect(second.neutralLoss).toBeLessThanOrEqual(100);
    if (mode === "open-centre") {
      expect(sqName(second.result.move!.to)).toBe("d4");
      expect(second.result.move?.capture).toBe("bp");
    } else expect(second.progress!.terms.attackers).toBeGreaterThan(0);
  }
});

test("hypothetical checked boards never count capturing the enemy king as legal access", () => {
  const p = fromFEN("3k4/8/1B6/8/8/8/8/6K1 b - - 0 20");
  const f = plans.planFeatures(p, "w");
  expect(f.attackers).toBe(1);
  expect(f.areaSquares).toBe(1); // c7, not the impossible Bd8 king capture.
  expect(f.lineAccess).toBe(7);
});

test("deadline during ranking discards all progress and retains completed neutral choice", async () => {
  const { searchRootCandidates } = await import("../../src/engine/search");
  const p = fromFEN(attack);
  let calls = 0;
  plans.explainPlannedMove(p, "club", 9, 30, () => {
    calls++;
    return 0;
  });
  let tick = 0;
  const expired = plans.explainPlannedMove(p, "club", 9, 30, () => (++tick >= calls - 2 ? 600 : 0));
  expect(expired.depth).toBe(2);
  expect(expired.reason).toBe("deadline");
  expect(expired.progress).toBeNull();
  expect(expired.neutralLoss).toBe(0);
  expect(expired.result.move).toEqual(searchRootCandidates(p, 2, 10000, fixed).fallback.move);
});

test("reserved time lets an incomplete deeper iteration retain and rank the previous complete roots", async () => {
  const { searchRootCandidates } = await import("../../src/engine/search");
  const p = fromFEN(development);
  let rootCalls = 0;
  searchRootCandidates(p, 1, 10000, () => {
    rootCalls++;
    return 0;
  });
  let ticks = 0;
  const d = plans.explainPlannedMove(p, "club", 9, 30, () => (++ticks > rootCalls + 10 ? 570 : 0));
  expect(d.depth).toBe(1);
  expect(d.searchTimedOut).toBe(true);
  expect(d.reason).toBe("plan");
  expect(d.progress!.terms.development).toBe(110);
  expect(d.neutralLoss).toBeLessThanOrEqual(100);
});
