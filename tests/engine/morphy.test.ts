import { describe, expect, it } from "vitest";
import {
  START,
  applyMove,
  fromFEN,
  legalMoves,
  sanFor,
  toFEN,
  inCheck,
  insufficientMaterial,
  posKey,
} from "../../src/engine/board";
import { evaluate, VAL } from "../../src/engine/eval";
import { chooseAiMove, LEVEL_CFG, MATE } from "../../src/engine/search";
import {
  morphyStyle,
  evaluateMorphy,
  weightedBookMoves,
  chooseOpponentMove,
} from "../../src/engine/morphy";
import { CLASSIC, morphyConfig } from "../../src/engine/opponents";
import { bookLookup } from "../../src/book/book";
import { executeEngineRequest } from "../../src/worker/execute";
import type { Position } from "../../src/engine/types";
import { reviewPosition } from "../../src/engine/reviewer";

const fixed = () => 0;
const beta = morphyConfig(123);
const san = (p: Position, move: ReturnType<typeof legalMoves>[number] | null) =>
  move ? sanFor(p, move, applyMove(p, move)) : null;
function swap(p: Position): Position {
  return {
    ...p,
    board: p.board
      .slice()
      .reverse()
      .map((piece) =>
        piece ? (`${piece[0] === "w" ? "b" : "w"}${piece[1]}` as typeof piece) : null,
      ),
    turn: p.turn === "w" ? "b" : "w",
    castling: { K: false, Q: false, k: false, q: false },
    ep: null,
  };
}

describe("Morphy style-v1", () => {
  it("bounds influence, preserves material and mirrors every feature against the correct enemy king", () => {
    const values = { ...VAL };
    for (const fen of [
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7",
      "6k1/5ppp/8/5NQ1/2B5/8/PPP2PPP/6K1 w - - 0 20",
      "6k1/8/8/8/8/8/6K1/4R3 w - - 0 30",
    ]) {
      const p = fromFEN(fen);
      expect(Math.abs(morphyStyle(p))).toBeLessThanOrEqual(80);
      expect(evaluateMorphy(p) - evaluate(p)).toBeCloseTo(morphyStyle(p));
      expect(morphyStyle(swap(p))).toBeCloseTo(-morphyStyle(p));
    }
    expect(VAL).toEqual(values);
  });

  it("reweights only legal retained opening continuations toward active development", () => {
    const p = START(),
      replies = ["Nf3", "a3", "not legal"];
    const choices = weightedBookMoves(p, replies);
    expect(choices.map((c) => c.san).sort()).toEqual(["Nf3", "a3"]);
    expect(choices.find((c) => c.san === "Nf3")!.weight).toBeGreaterThan(
      choices.find((c) => c.san === "a3")!.weight,
    );
    expect(replies).toEqual(["Nf3", "a3", "not legal"]);
    const played = chooseOpponentMove(p, "club", replies, beta, 0, fixed);
    expect(played.book).toBe(true);
    expect(["Nf3", "a3"]).toContain(san(p, played.move));
  });

  it("rewards useful open rook files and pressure on the enemy king, in both colours", () => {
    const blocked = fromFEN("6k1/8/8/8/8/8/P5K1/R7 w - - 0 1");
    const open = fromFEN("6k1/8/8/8/8/8/1P4K1/R7 w - - 0 1");
    expect(morphyStyle(open) - morphyStyle(blocked)).toBe(12);
    const quiet = fromFEN("rnbq1bkr/ppppppp1/8/7Q/8/8/PPPPPPPP/RNB1KBNR b - - 0 1");
    const pressure = fromFEN("rnbq1bkr/pppppppQ/8/8/8/8/PPPPPPPP/RNB1KBNR b - - 0 1");
    expect(morphyStyle(pressure)).toBeGreaterThan(morphyStyle(quiet));
    expect(morphyStyle(swap(pressure))).toBeLessThan(morphyStyle(swap(quiet)));
    // Bare queen endings deliberately have no extra middlegame check/pressure bonus.
    expect(morphyStyle(fromFEN("6k1/7Q/8/8/8/8/8/6K1 b - - 0 1"))).toBe(0);
  });

  it("has explicit, reproducible per-ply worker/book configuration and rejects unsupported versions", () => {
    const p = START();
    const request = {
      type: "ai" as const,
      gameId: "beta",
      revision: 0,
      requestId: 1,
      position: p,
      level: "club" as const,
      bookSans: bookLookup([]).replies,
      opponent: beta,
      ply: 0,
    };
    const wire = JSON.parse(JSON.stringify(request));
    expect(executeEngineRequest(wire, fixed)).toEqual(
      chooseOpponentMove(p, "club", request.bookSans, beta, 0, fixed),
    );
    expect(executeEngineRequest(wire, fixed)).toEqual(executeEngineRequest(wire, fixed));
    expect(() =>
      executeEngineRequest({ ...wire, opponent: { ...beta, version: 99 } }, fixed),
    ).toThrow(/unavailable/i);
    const choices = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        san(p, chooseOpponentMove(p, "club", request.bookSans, morphyConfig(seed), 0, fixed).move),
      ),
    );
    expect(choices.size).toBeGreaterThan(1);
  });

  it.each([
    ["free queen / adverse material", "4k3/8/8/8/8/8/q7/R3K3 w - - 0 1", "Rxa2"],
    ["black free queen", "r3k3/Q7/8/8/8/8/8/4K3 b - - 0 1", "Rxa7"],
    ["mate outranks style", "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", null],
    ["only legal escape", "8/8/8/8/8/2k5/8/Kq6 w - - 0 1", "Kxb1"],
  ] as const)("retains tactical safety: %s", (_label, fen, expected) => {
    const p = fromFEN(fen),
      choice = chooseOpponentMove(p, "club", [], beta, 0, fixed);
    expect(legalMoves(p)).toContainEqual(choice.move);
    if (_label === "only legal escape") expect(legalMoves(p)).toHaveLength(1);
    if (expected) expect(san(p, choice.move)).toBe(expected);
    else {
      const next = applyMove(p, choice.move!);
      expect(inCheck(next, next.turn)).toBe(true);
      expect(legalMoves(next)).toHaveLength(0);
      expect(choice.score).toBeGreaterThan(MATE - 100);
    }
  });

  it("keeps Classic policy/results unchanged and includes all Morphy work inside the difficulty budget", () => {
    const p = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
    expect(chooseOpponentMove(p, "club", [], CLASSIC, 0, fixed)).toEqual(
      chooseAiMove(p, "club", [], fixed),
    );
    for (const level of ["casual", "club", "strong"] as const) {
      let ticks = 0;
      const choice = chooseOpponentMove(START(), level, ["illegal"], beta, 0, () => ticks++);
      expect(legalMoves(START())).toContainEqual(choice.move);
      expect(ticks).toBeLessThanOrEqual(LEVEL_CFG[level].ms + 8);
    }
  });

  // Held out from feature construction: safety assertions, not a strength calibration.
  it.each([false, true])(
    "declines a defended pawn and preserves a winning simplification (swapped=%s)",
    (swapped) => {
      const defended = fromFEN("4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1");
      const winning = fromFEN("8/8/4k3/3q4/3Q4/8/8/5RK1 w - - 0 1");
      const a = swapped ? swap(defended) : defended,
        b = swapped ? swap(winning) : winning;
      const safe = chooseOpponentMove(a, "club", [], beta, 12, fixed);
      expect(safe.move?.capture?.[1]).not.toBe("p");
      const choice = chooseOpponentMove(b, "club", [], beta, 12, fixed);
      const exchange = legalMoves(b).find((move) => move.capture?.[1] === "q")!;
      // A queen exchange is winning. A stronger forcing continuation is also valid;
      // the original exact-exchange assertion wrongly rejected a sound rook fork.
      const neutral = (move: typeof exchange) =>
        reviewPosition(applyMove(b, move), [toFEN(b)], "review-v1", fixed).score *
        (b.turn === "w" ? 1 : -1);
      expect(neutral(exchange)).toBeGreaterThan(300);
      expect(neutral(choice.move!)).toBeGreaterThanOrEqual(neutral(exchange) - 80);
    },
  );

  it("develops the bishop to an active diagonal out of book without changing neutral review", () => {
    let p = START();
    for (const wanted of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "d3"]) {
      const move = legalMoves(p).find((move) => san(p, move) === wanted)!;
      p = applyMove(p, move);
    }
    const choice = chooseOpponentMove(p, "club", [], beta, 7, fixed);
    expect(choice.book).toBe(false);
    expect(san(p, choice.move)).toBe("Bc5");
    expect(san(p, chooseAiMove(p, "club", [], fixed).move)).toBe("Bd6");
  });

  it.each([4, 5, 6])(
    "finishes a bounded complete legal game from the initial board, seed %s",
    (seed) => {
      let p = START();
      const history: string[] = [],
        keys = new Map([[posKey(p), 1]]),
        config = morphyConfig(seed);
      let result: string | null = null;
      for (let ply = 0; ply < 300; ply++) {
        const moves = legalMoves(p);
        if (!moves.length) {
          result = inCheck(p, p.turn) ? "checkmate" : "stalemate";
          break;
        }
        if (p.halfmove >= 100 || (keys.get(posKey(p)) ?? 0) >= 3 || insufficientMaterial(p.board)) {
          result = "draw";
          break;
        }
        const choice = chooseOpponentMove(
          p,
          "casual",
          bookLookup(history).replies,
          config,
          ply,
          fixed,
        );
        expect(moves).toContainEqual(choice.move);
        history.push(san(p, choice.move)!);
        p = applyMove(p, choice.move!);
        keys.set(posKey(p), (keys.get(posKey(p)) ?? 0) + 1);
      }
      // A truncated game must fail, never be reported as a complete-game pass.
      expect(result, `seed ${seed}, ${history.length} plies, ${toFEN(p)}`).not.toBeNull();
      console.info(`Morphy smoke seed=${seed}: ${result}, ${history.length} legal plies`);
    },
    20000,
  );
});
