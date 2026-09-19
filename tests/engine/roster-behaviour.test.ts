import { expect, test } from "vitest";
import { applyMove, fromFEN, inCheck, legalMoves, sanFor } from "../../src/engine/board";
import { searchRootCandidates } from "../../src/engine/search";
import { explainTalMove } from "../../src/engine/roster/tal";
import { explainSpasskyMove } from "../../src/engine/roster/spassky";
import { explainFischerMove, fischerPolicy } from "../../src/engine/roster/fischer";
import { features, offeredMaterial } from "../../src/engine/roster/features";
import { explainMove, type Policy } from "../../src/engine/roster/policy";
import { rosterBookKey } from "../../src/engine/roster/book";
import type { Position } from "../../src/engine/types";
const mirror = (p: Position): Position => ({
  ...p,
  board: p.board.map((_, i) => {
    const x = p.board[i ^ 56];
    return x ? (`${x[0] === "w" ? "b" : "w"}${x[1]}` as typeof x) : null;
  }),
  turn: p.turn === "w" ? "b" : "w",
  castling: { K: p.castling.k, Q: p.castling.q, k: p.castling.K, q: p.castling.Q },
  ep: p.ep === null ? null : p.ep ^ 56,
});
const san = (p: Position, m: NonNullable<ReturnType<typeof explainTalMove>["result"]["move"]>) =>
  sanFor(p, m, applyMove(p, m));
const move = (p: Position, name: string) => {
  const m = legalMoves(p).find((m) => san(p, m) === name);
  expect(m).toBeDefined();
  return m!;
};
const engines = [explainSpasskyMove, explainTalMove, explainFischerMove];
const speculative = "3q1rk1/pp3ppp/5n2/3p4/7Q/3B4/PPP1p1PP/5RK1 w - - 0 20";
for (const reflected of [false, true]) {
  const position = (fen: string) => (reflected ? mirror(fromFEN(fen)) : fromFEN(fen));
  const reflectedMove = (p: Position, original: Position, name: string) => {
    const m = move(original, name);
    return legalMoves(p).find(
      (x) => x.from === (m.from ^ 56) && x.to === (m.to ^ 56) && x.promo === m.promo,
    )!;
  };
  test(`both-color actual multi-turn priorities (${reflected})`, () => {
    const cases = [
      {
        engine: explainSpasskyMove,
        fen: "r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
        first: "Nc3",
        reply: "a6",
        second: "Nf3",
      },
      {
        engine: explainSpasskyMove,
        fen: "r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9",
        first: "d4",
        reply: "exd4",
        second: "Nxd4",
      },
      {
        engine: explainFischerMove,
        fen: "r2q1rk1/pp3ppp/2n1bn2/2p1p3/2P1P3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12",
        first: "Bxc5",
        reply: "Re8",
        second: "Ng5",
      },
      {
        engine: explainFischerMove,
        fen: "6k1/5ppp/8/3P4/4K3/8/5PPP/8 w - - 0 30",
        first: "d6",
        reply: "Kf8",
        second: "Kd5",
      },
    ];
    for (const c of cases) {
      let original = fromFEN(c.fen),
        p = position(c.fen);
      for (const [n, name] of [c.first, c.reply, c.second].entries()) {
        const expected = reflected ? reflectedMove(p, original, name) : move(p, name);
        if (n !== 1) {
          const d = c.engine(p, "club", 9, 30 + n, () => 0);
          expect(d.result.book).toBe(false);
          if (reflected && name === "Kd5") {
            expect(san(p, d.result.move!)).toBe("Ke4");
            expect(features(applyMove(p, d.result.move!), p.turn).passed).toBeGreaterThan(
              features(p, p.turn).passed,
            );
          } else expect(d.result.move).toEqual(expected);
          expect(d.neutralLoss).toBeLessThanOrEqual(c.engine === explainSpasskyMove ? 100 : 50);
        }
        p = applyMove(p, expected);
        original = applyMove(original, move(original, name));
      }
    }
  });
  test(`Tal genuinely speculative exchange and forcing continuation (${reflected})`, () => {
    const p = position(speculative),
      d = explainTalMove(p, "club", 9, 30, () => 0),
      m = d.result.move!;
    expect(san(p, m)).toBe(reflected ? "Rxf3" : "Rxf6");
    expect(d.result.book).toBe(false);
    expect(d.neutralLoss).toBeGreaterThan(0);
    expect(d.neutralLoss).toBeLessThanOrEqual(150);
    expect(offeredMaterial(p, m)).toBe(80);
    const neutral = searchRootCandidates(p, 2, 10000, () => 0);
    expect(m).not.toEqual(neutral.fallback.move);
    expect(explainFischerMove(p, "club", 9, 30, () => 0).result.move).not.toEqual(m);
    const unsupported = { ...p, board: p.board.map((x) => (x === `${p.turn}b` ? null : x)) };
    expect(explainTalMove(unsupported, "club", 9, 30, () => 0).result.move).not.toEqual(m);
    const replyPosition = applyMove(p, m),
      reply = move(replyPosition, reflected ? "gxf3" : "gxf6"),
      continued = applyMove(replyPosition, reply);
    // Rook500 exchanged for knight320; subsequent pawn recovery can reduce the deficit to80.
    expect(features(continued, p.turn).material).toBe(features(p, p.turn).material - 180);
    const follow = explainTalMove(continued, "club", 9, 32, () => 0);
    expect(san(continued, follow.result.move!)).toBe(reflected ? "Qxh2#" : "Qxh7#");
    expect(inCheck(applyMove(continued, follow.result.move!), replyPosition.turn)).toBe(true);
  });
  test(`tactical safety, terminal-before-book and pins (${reflected})`, () => {
    const trap = position("3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20");
    for (const engine of engines) {
      const d = engine(trap, "strong", 7, 0, () => 0);
      expect(d.result.move?.capture).toBeUndefined();
      expect(d.neutralLoss).toBeLessThanOrEqual(150);
      const queen = position("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
      expect(engine(queen, "club", 7, 0, () => 0).result.move?.capture).toBe(
        reflected ? "wq" : "bq",
      );
      const mate = position("7k/8/6K1/6Q1/8/8/8/8 w - - 0 1"),
        d2 = engine(mate, "club", 7, 0, () => 0);
      expect(d2.reason).toBe("mate");
      const next = applyMove(mate, d2.result.move!);
      expect(legalMoves(next)).toHaveLength(0);
      expect(inCheck(next, next.turn)).toBe(true);
    }
    const pinned = position("4r2k/7p/8/8/3P4/8/4B3/4K3 w - - 0 30");
    expect(features(pinned, pinned.turn).bishops).toBe(0);
    const terminal = { ...trap, halfmove: 100 };
    expect(
      explainMove(
        terminal,
        "club",
        1,
        0,
        { [rosterBookKey(terminal)]: [[reflected ? "d8d4" : "d1d5", 999]] },
        fischerPolicy,
        () => 0,
      ).reason,
    ).toBe("terminal");
    const harmful = move(trap, reflected ? "Qxd4" : "Qxd5");
    expect(fischerPolicy.prepare(trap).bonus(harmful, -500)).toBe(0);
  });
}
test("frequency weighting, deterministic identity, illegal book entry and invalid inputs", () => {
  const p = fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    book = {
      [rosterBookKey(p)]: [
        ["e2e4", 9],
        ["d2d4", 1],
        ["a1a8", 99999],
      ],
    };
  let e4 = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const d = explainMove(p, "club", seed, 0, book, fischerPolicy, () => 0);
    expect(d.reason).toBe("book");
    if (san(p, d.result.move!) === "e4") e4++;
  }
  expect(e4).toBeGreaterThan(850);
  expect(e4).toBeLessThan(950);
  expect(explainTalMove(p, "club", 4, 2, () => 0)).toEqual(
    explainTalMove(p, "club", 4, 2, () => 0),
  );
  for (const seed of [-1, NaN, 1.5, 2 ** 32])
    expect(() => explainTalMove(p, "club", seed, 0)).toThrow();
  expect(() => explainTalMove(p, "club", 0, -1)).toThrow();
});
test("expired search and partial style ranking discard preference", () => {
  const p = fromFEN(speculative);
  let tick = 0;
  const incomplete = explainMove(p, "club", 1, 0, {}, fischerPolicy, () => tick++ * 1000);
  expect(incomplete.reason).toBe("incomplete");
  expect(incomplete.depth).toBe(0);
  let time = 0,
    calls = 0;
  const policy: Policy = {
    loss: 150,
    cap: 360,
    prepare: () => ({
      plan: "test",
      bonus: () => {
        calls++;
        time = 10000;
        return 360;
      },
    }),
  };
  const d = explainMove(p, "club", 1, 0, {}, policy, () => time);
  expect(calls).toBe(1);
  expect(d.reason).toBe("deadline");
  expect(d.result.move).toEqual(searchRootCandidates(p, 2, 10000, () => 0).fallback.move);
  expect(d.bonus).toBe(0);
});

test("an interrupted deeper search keeps only the previous complete ranking", () => {
  const p = fromFEN(speculative);
  let count = 0;
  const complete = searchRootCandidates(p, 1, 10000, () => {
    count++;
    return 0;
  });
  let calls = 0;
  const interrupted = searchRootCandidates(p, 4, 10000, () => (++calls > count ? 10000 : 0));
  expect(interrupted.timedOut).toBe(true);
  expect(interrupted.depth).toBe(1);
  expect(interrupted.candidates).toEqual(complete.candidates);
  expect(interrupted.fallback).toEqual(complete.fallback);
});

test("Fischer takes a favorable rook exchange while refusing the losing queen capture", () => {
  const p = fromFEN("4k3/r7/8/3P4/8/8/8/R3K3 w - - 0 1");
  const d = explainFischerMove(p, "club", 9, 0, () => 0);
  expect(san(p, d.result.move!)).toBe("Rxa7");
  expect(d.plan).toBe("favorable-conversion");
  expect(d.bonus).toBeGreaterThan(0);
});

for (const reflected of [false, true]) {
  test(`Fischer conversion rewards require a favorable neutral score (${reflected})`, () => {
    const fixtures = [
      { fen: "6k1/5ppp/3P4/8/4K3/8/5PPP/8 w - - 0 31", sans: ["Kd5", "d7"] },
      { fen: "6k1/5ppp/3P4/8/4K3/8/5PPP/7R w - - 0 31", sans: ["Ra1"] },
    ];
    for (const fixture of fixtures) {
      const original = fromFEN(fixture.fen),
        p = reflected ? mirror(original) : original;
      const preference = fischerPolicy.prepare(p);
      expect(preference.plan).toBe("favorable-conversion");
      for (const name of fixture.sans) {
        const originalMove = move(original, name);
        const candidate = reflected
          ? legalMoves(p).find(
              (m) => m.from === (originalMove.from ^ 56) && m.to === (originalMove.to ^ 56),
            )!
          : originalMove;
        expect(preference.bonus(candidate, 500)).toBeGreaterThan(0);
        expect(preference.bonus(candidate, -500)).toBe(0);
        expect(preference.bonus(candidate, 79)).toBe(0);
      }
    }
  });
  test(`Fischer conversion does not reward abandoning immediate attack (${reflected})`, () => {
    const original = fromFEN("6k1/R4ppp/3P4/8/4K3/8/5PPP/8 w - - 0 31"),
      p = reflected ? mirror(original) : original;
    const candidate = move(p, reflected ? "d2" : "d7"),
      after = features(applyMove(p, candidate), p.turn),
      before = features(p, p.turn);
    expect(after.passed).toBeGreaterThan(before.passed);
    expect(after.attackers).toBeLessThan(before.attackers);
    expect(after.material).toBe(before.material);
    const preference = fischerPolicy.prepare(p);
    expect(preference.plan).toBe("favorable-conversion");
    expect(preference.bonus(candidate, 500)).toBe(0);
  });
}
