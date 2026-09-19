import { expect, test } from "vitest";
import {
  START,
  applyMove,
  fromFEN,
  legalMoves,
  sanFor,
  sqName,
  toFEN,
} from "../../src/engine/board";
import { chigorinBookKey } from "../../src/engine/chigorin-book";
import * as chigorin from "../../src/engine/chigorin";
import { chooseOpponentMove } from "../../src/engine/morphy";
import { chigorinConfig, isRatedOpponent, isSupportedOpponent } from "../../src/engine/opponents";
import book from "../../src/book/chigorin-book.json";
import type { Move, Position } from "../../src/engine/types";
const fixed = () => 0;
const san = (p: Position, m: Move | null) => (m ? sanFor(p, m, applyMove(p, m)) : null);
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
const development = "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
const knight = "r4rk1/pp3ppp/2p1b3/4p3/2PP4/2N1PN2/PP3PPP/R2Q1RK1 w - - 0 16";
const centre = "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9";
const attack = "r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16";
test("supports and rates only the exact accepted Chigorin identity", () => {
  expect(isSupportedOpponent(chigorinConfig(7))).toBe(true);
  expect(isRatedOpponent(chigorinConfig(7))).toBe(true);
  for (const c of [
    { ...chigorinConfig(7), version: 2 },
    { ...chigorinConfig(7), engine: "plans-v1" },
    { ...chigorinConfig(7), seed: null },
  ]) {
    expect(isSupportedOpponent(c)).toBe(false);
    expect(isRatedOpponent(c)).toBe(false);
  }
  const p = fromFEN(development);
  expect(chooseOpponentMove(p, "club", ["Qh5"], chigorinConfig(7), 6, fixed)).toEqual(
    chigorin.chooseChigorinMove(p, "club", 7, 6, fixed),
  );
});
test("declared behavior fixtures are off-book and actual moves honor tactical safety", () => {
  for (const fen of [development, knight, centre, attack])
    for (const p of [fromFEN(fen), mirror(fromFEN(fen))]) {
      expect(Object.hasOwn(book, chigorinBookKey(p))).toBe(false);
      const d = chigorin.explainChigorinMove(p, "club", 9, 30, fixed);
      expect(legalMoves(p)).toContainEqual(d.result.move);
      expect(d.neutralLoss).toBeLessThanOrEqual(100);
      expect(d.progress?.bonus ?? 0).toBeLessThanOrEqual(240);
    }
});
test("actual choices take mate and free queen for both colors", () => {
  for (const [fen, want] of [
    ["7k/8/6K1/6Q1/8/8/8/8 w - - 0 1", "Qd8#"],
    ["4k3/8/8/8/8/8/q7/R3K3 w - - 0 1", "Rxa2"],
  ]) {
    const p = fromFEN(fen),
      a = chigorin.chooseChigorinMove(p, "club", 1, 24, fixed),
      b = chigorin.chooseChigorinMove(mirror(p), "club", 1, 24, fixed);
    expect(san(p, a.move)).toBe(want);
    expect(b.move?.from).toBe(a.move!.from ^ 56);
    expect(b.move?.to).toBe(a.move!.to ^ 56);
    expect(b.score).toBe(-a.score!);
  }
  for (const p of [
    fromFEN("3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20"),
    mirror(fromFEN("3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20")),
  ])
    expect(chigorin.chooseChigorinMove(p, "club", 9, 40, fixed).move?.capture).toBeUndefined();
});
test("develops successive home minors, challenges the centre and occupies a supported knight square", () => {
  for (const reflect of [false, true]) {
    let p = reflect ? mirror(fromFEN(development)) : fromFEN(development);
    for (const reply of ["a6", "d6"]) {
      const d = chigorin.explainChigorinMove(p, "club", 9, 8, fixed);
      expect(["b", "n"]).toContain(p.board[d.result.move!.from]?.[1]);
      expect(d.result.move!.from >> 3).toBe(reflect ? 0 : 7);
      p = applyMove(p, d.result.move!);
      const r = legalMoves(p).find(
        (m) =>
          san(reflect ? mirror(p) : p, reflect ? { ...m, from: m.from ^ 56, to: m.to ^ 56 } : m) ===
          reply,
      );
      expect(r).toBeDefined();
      p = applyMove(p, r!);
    }
    const c = reflect ? mirror(fromFEN(centre)) : fromFEN(centre),
      d = chigorin.explainChigorinMove(c, "club", 9, 16, fixed);
    expect(
      san(
        reflect ? mirror(c) : c,
        reflect
          ? { ...d.result.move!, from: d.result.move!.from ^ 56, to: d.result.move!.to ^ 56 }
          : d.result.move,
      ),
    ).toBe("d4");
    const k = reflect ? mirror(fromFEN(knight)) : fromFEN(knight),
      km = chigorin.chooseChigorinMove(k, "club", 9, 30, fixed).move!;
    expect(k.board[km.from]?.[1]).toBe("n");
    expect([27, 28].map((s) => (reflect ? s ^ 56 : s))).toContain(km.to);
  }
});
test("pinned knights have no activity and endings retain knight improvement without attack", () => {
  const p = fromFEN("4r2k/7p/8/8/3P4/8/4N3/4K3 w - - 0 30");
  expect(chigorin.chigorinFeatures(p, "w").knightActivity).toBe(0);
  expect(
    chigorin.chigorinFeatures(fromFEN("7k/7p/8/8/3P4/8/4N3/4K3 w - - 0 30"), "w").knightActivity,
  ).toBeGreaterThan(0);
  for (const q of [
    fromFEN("7k/7p/8/8/3P4/2N5/P7/6K1 w - - 0 30"),
    mirror(fromFEN("7k/7p/8/8/3P4/2N5/P7/6K1 w - - 0 30")),
  ]) {
    const d = chigorin.explainChigorinMove(q, "club", 9, 60, fixed);
    expect(d.plan.mode).toBe("knight-activity");
    expect(q.board[d.result.move!.from]?.[1]).toBe("n");
    expect(d.progress?.terms.attackers ?? 0).toBe(0);
  }
});
test("terminal moves, invalid identity, deterministic replay and deadline fallback", () => {
  for (const p of [{ ...START(), halfmove: 100 }, fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")])
    expect(chigorin.chooseChigorinMove(p, "club", 1, 0, fixed).move).toBeNull();
  expect(() => chigorinConfig(-1)).toThrow(/seed/);
  expect(() => chigorin.chooseChigorinMove(START(), "club", 1, -1, fixed)).toThrow(/identity/);
  const p = fromFEN(attack);
  expect(chigorin.explainChigorinMove(p, "club", 81, 30, fixed)).toEqual(
    chigorin.explainChigorinMove(p, "club", 81, 30, fixed),
  );
  let t = 0;
  const expired = chigorin.explainChigorinMove(p, "club", 9, 30, () => t++ * 100);
  expect(expired.reason).toMatch(/deadline|incomplete/);
  expect(expired.progress).toBeNull();
  expect(expired.neutralLoss).toBe(0);
  expect(legalMoves(p)).toContainEqual(expired.result.move);
});

test("central contact survives exchange, and coordinated attack adds another piece on the next turn", () => {
  for (const [fen, reply, firstSan, secondSan] of [
    [centre, "exd4", "d4", "Nxd4"],
    [attack, "fxe6", "Bxe6", "Ng5"],
  ])
    for (const reflect of [false, true]) {
      let p = reflect ? mirror(fromFEN(fen)) : fromFEN(fen);
      for (const [i, want] of [firstSan, secondSan].entries()) {
        const d = chigorin.explainChigorinMove(p, "club", 9, 30 + i * 2, fixed),
          m = d.result.move!;
        expect(
          san(reflect ? mirror(p) : p, reflect ? { ...m, from: m.from ^ 56, to: m.to ^ 56 } : m),
        ).toBe(want);
        expect(d.neutralLoss).toBeLessThanOrEqual(100);
        if (fen === attack) expect(d.progress!.terms.attackers).toBeGreaterThan(0);
        p = applyMove(p, m);
        if (i === 0) {
          const response = legalMoves(p).find(
            (m) =>
              san(
                reflect ? mirror(p) : p,
                reflect ? { ...m, from: m.from ^ 56, to: m.to ^ 56 } : m,
              ) === reply,
          );
          expect(response).toBeDefined();
          p = applyMove(p, response!);
        }
      }
    }
});

test("book choices are documented legal continuations, weighted reproducibly by recorded count", () => {
  const p = START(),
    entries = (book as Record<string, [string, number][]>)[chigorinBookKey(p)];
  function random(seed: number) {
    let state = seed >>> 0;
    for (const c of `${toFEN(p)}:0`) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  for (let seed = 0; seed < 100; seed++) {
    let target = random(seed) * entries.reduce((s, [, n]) => s + n, 0);
    const expected = entries.find(([, n]) => (target -= n) < 0)![0];
    const d = chigorin.chooseChigorinMove(p, "casual", seed, 0, fixed),
      m = d.move!;
    expect(d.book).toBe(true);
    expect(`${sqName(m.from)}${sqName(m.to)}${m.promo ?? ""}`).toBe(expected);
    expect(chooseOpponentMove(p, "club", ["a3"], chigorinConfig(seed), 0, fixed)).toEqual(d);
  }
});

test("deadline during ranking discards partial style and preserves complete neutral roots", async () => {
  const { searchRootCandidates } = await import("../../src/engine/search");
  const p = fromFEN(attack);
  let calls = 0;
  chigorin.explainChigorinMove(p, "club", 9, 30, () => {
    calls++;
    return 0;
  });
  let tick = 0;
  const expired = chigorin.explainChigorinMove(p, "club", 9, 30, () =>
    ++tick >= calls - 2 ? 600 : 0,
  );
  expect(expired.depth).toBe(2);
  expect(expired.reason).toBe("deadline");
  expect(expired.progress).toBeNull();
  expect(expired.neutralLoss).toBe(0);
  expect(expired.result.move).toEqual(searchRootCandidates(p, 2, 10000, fixed).fallback.move);
});

test("exposed own king does not justify a coordinated attack", () => {
  const p = fromFEN("r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP5/R2Q1RK1 w - - 0 16");
  expect(chigorin.chigorinPlan(p).mode).not.toBe("coordinated-attack");
});

test("balanced off-book middlegame places a pawn-supported knight on d5 for both colors", () => {
  const p = fromFEN("r1bq1rk1/pp2bppp/2n2n2/2p1p3/2P1P3/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 12");
  for (const reflect of [false, true]) {
    const q = reflect ? mirror(p) : p,
      d = chigorin.explainChigorinMove(q, "club", 9, 24, fixed),
      m = d.result.move!;
    expect(Object.hasOwn(book, chigorinBookKey(q))).toBe(false);
    expect(san(p, reflect ? { ...m, from: m.from ^ 56, to: m.to ^ 56 } : m)).toBe("Nd5");
    expect(d.progress!.terms.outposts).toBeGreaterThan(0);
    expect(d.neutralLoss).toBeLessThanOrEqual(100);
  }
});
