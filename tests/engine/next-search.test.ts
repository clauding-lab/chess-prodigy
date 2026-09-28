import { searchNextShortlist } from "../../src/engine/next/shortlist-search";
import { searchNextShortlistReuse } from "../../src/engine/next/shortlist-reuse-search";
import { searchNextCached } from "../../src/engine/next/cached-search";
import { describe, expect, it } from "vitest";
import {
  applyMove,
  fromFEN,
  inCheck,
  legalMoves,
  posKey,
  sameMove,
  sqIndex,
  toFEN,
} from "../../src/engine/board";
import { searchNext as referenceSearch } from "../../src/engine/next/search";
import { evaluate } from "../../src/engine/eval";
import { isDeadPositionV2 } from "../../src/engine/rules-v2";
import type { Position } from "../../src/engine/types";

// Deliberately exhaustive: no alpha/beta, ordering, shared repetition map or production search calls.
function oracle(
  p: Position,
  depth: number,
  prior: string[],
  ply = 0,
  captures = 4,
  safety = 12,
): number {
  const moves = legalMoves(p);
  if (!moves.length) return inCheck(p, p.turn) ? -100000 + ply : 0;
  if (
    p.halfmove >= 100 ||
    prior.filter((key) => key === posKey(p)).length >= 2 ||
    isDeadPositionV2(p.board)
  )
    return 0;
  const checked = inCheck(p, p.turn);
  const staticScore = evaluate(p) * (p.turn === "w" ? 1 : -1);
  const nextPrior = [...prior, posKey(p)];
  if (depth > 0)
    return Math.max(
      ...moves.map((move) => -oracle(applyMove(p, move), depth - 1, nextPrior, ply + 1)),
    );
  if (checked && safety <= 0) throw new Error("Oracle forcing cap");
  if (!checked && (captures <= 0 || safety <= 0)) return staticScore;
  const continuations = checked ? moves : moves.filter((move) => move.capture || move.promo);
  return Math.max(
    checked ? -Infinity : staticScore,
    ...continuations.map(
      (move) => -oracle(applyMove(p, move), 0, nextPrior, ply + 1, captures - 1, safety - 1),
    ),
  );
}

describe.each([
  ["reference", referenceSearch],
  ["cached", searchNextCached],
  ["shortlist", searchNextShortlist],
  ["shortlist-reuse", searchNextShortlistReuse],
] as const)("%s search", (_name, searchNext) => {
  const poison = fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1");
  const fixed = { maxDepth: 2, ms: 1000, now: () => 0, baselineOnly: true } as const;
  it("returns explicit incomplete work rather than an ordered capture when no baseline fits", () => {
    for (const options of [
      { ...fixed, ms: 0 },
      { ...fixed, maxNodes: 2 },
    ]) {
      const result = searchNext(poison, [], options);
      expect(result.kind).toBe("incomplete");
      expect(result.move).toBeNull();
      expect(result.score).toBeNull();
      expect(result.candidates).toEqual([]);
      expect(result.depth).toBe(0);
    }
  });
  it("completes every shallow alternative and avoids the poisoned queen capture", () => {
    const result = searchNext(poison, [], fixed);
    expect(result.kind).toBe("completed");
    expect(result.depth).toBe(2);
    expect(result.move).not.toMatchObject({ from: sqIndex("e4"), to: sqIndex("d5") });
    expect(result.candidates).toHaveLength(legalMoves(poison).length);
    expect(
      result.candidates.every(
        (entry) => Number.isFinite(entry.score) && entry.kind === "exact" && entry.depth === 2,
      ),
    ).toBe(true);
    expect(
      new Set(
        result.candidates.map((entry) => `${entry.move.from}:${entry.move.to}:${entry.move.promo}`),
      ).size,
    ).toBe(result.candidates.length);
  });
  it("retains the entire completed baseline when a deeper comparison is interrupted", () => {
    const baseline = searchNext(poison, [], fixed);
    const interrupted = searchNext(poison, [], {
      ...fixed,
      baselineOnly: false,
      maxDepth: 4,
      maxNodes: baseline.nodes + 1,
    });
    expect(interrupted.kind).toBe("completed");
    expect(interrupted.interruption).toBe("nodes");
    expect(interrupted.move).toEqual(baseline.move);
    expect(interrupted.candidates).toEqual(baseline.candidates);
    expect(interrupted.phase).toBe("baseline");
    expect(interrupted.depth).toBe(2);
  });
  it("returns legal immediate mates and honors terminal precedence over draw counters", () => {
    const position = fromFEN("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    const result = searchNext(position, [], fixed);
    expect(result.move).not.toBeNull();
    const next = applyMove(position, result.move!);
    expect(legalMoves(next)).toHaveLength(0);
    expect(inCheck(next, next.turn)).toBe(true);
    next.halfmove = 100;
    const ended = searchNext(next, [toFEN(next), toFEN(next)], { ...fixed, ms: 0 });
    expect(ended.kind).toBe("terminal");
    expect(ended.terminal).toBe("checkmate");
    expect(ended.score).toBeGreaterThan(90000);
  });
  it("uses prior history for threefold and keeps the root/history unchanged after abort", () => {
    const before = JSON.stringify(poison);
    const prior = [toFEN(poison), toFEN(poison)];
    expect(searchNext(poison, prior, fixed).terminal).toBe("threefold-repetition");
    expect(searchNext(poison, [], { ...fixed, maxNodes: 3 }).kind).toBe("incomplete");
    const resumed = searchNext(poison, [], fixed);
    expect(resumed.kind).toBe("completed");
    expect(legalMoves(poison).some((move) => sameMove(move, resumed.move))).toBe(true);
    expect(JSON.stringify(poison)).toBe(before);
    expect(prior).toEqual([toFEN(poison), toFEN(poison)]);
  });

  it("keeps White-relative scores while Black avoids its own poisoned capture", () => {
    const black = fromFEN("4k3/8/8/4q3/3P4/2P5/8/4K3 b - - 0 1");
    const result = searchNext(black, [], fixed);
    expect(result.kind).toBe("completed");
    expect(result.score).toBeLessThan(-500);
    expect(result.move).not.toMatchObject({ from: sqIndex("e5"), to: sqIndex("d4") });
    expect(result.score).toBe(Math.min(...result.candidates.map((candidate) => candidate.score)));
  });

  it("returns a completed forced evasion and a legal choice even when every move loses material", () => {
    const forced = fromFEN("7k/8/6K1/8/8/8/7R/8 b - - 0 1");
    const result = searchNext(forced, [], fixed);
    expect(result.kind).toBe("completed");
    expect(result.move).toMatchObject({ from: sqIndex("h8"), to: sqIndex("g8") });
    const losing = fromFEN("6k1/8/4Q1K1/8/8/8/8/8 b - - 0 1");
    const defense = searchNext(losing, [], fixed);
    expect(defense.kind).toBe("completed");
    expect(defense.score).toBeGreaterThan(500);
    expect(legalMoves(losing).some((move) => sameMove(move, defense.move))).toBe(true);
  });

  it("recognizes stalemate, fifty moves and new dead positions without an evaluated fallback", () => {
    for (const [fen, terminal] of [
      ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "stalemate"],
      ["4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 100 51", "fifty-move-rule"],
      ["7k/8/8/8/8/4B3/8/K1B5 w - - 0 1", "dead-position"],
    ]) {
      const result = searchNext(fromFEN(fen), [], { ...fixed, ms: 0 });
      expect(result.kind).toBe("terminal");
      expect(result.terminal).toBe(terminal);
      expect(result.move).toBeNull();
      expect(result.score).toBe(0);
    }
  });

  it("does not publish a finished candidate array when the final deadline check fails", () => {
    let calls = 0;
    searchNext(poison, [], {
      ...fixed,
      now: () => {
        calls++;
        return 0;
      },
    });
    let interruptedCalls = 0;
    const result = searchNext(poison, [], {
      ...fixed,
      now: () => (++interruptedCalls >= calls - 1 ? 1000 : 0),
    });
    expect(result.kind).toBe("incomplete");
    expect(result.interruption).toBe("deadline");
    expect(result.candidates).toEqual([]);
  });

  it("retains a complete baseline when cancellation occurs during refinement", () => {
    let calls = 0;
    const baseline = searchNext(poison, [], {
      ...fixed,
      now: () => {
        calls++;
        return 0;
      },
    });
    let checks = 0;
    const result = searchNext(poison, [], {
      ...fixed,
      baselineOnly: false,
      maxDepth: 4,
      cancelled: () => ++checks > calls + 5,
    });
    expect(result.kind).toBe("completed");
    expect(result.interruption).toBe("cancelled");
    expect(result.candidates).toEqual(baseline.candidates);
  });

  it("rejects an expired absolute deadline and non-finite injected clocks", () => {
    expect(searchNext(poison, [], { ...fixed, absoluteDeadline: 0 }).kind).toBe("incomplete");
    expect(() => searchNext(poison, [], { ...fixed, now: () => NaN })).toThrow(
      "Invalid search clock",
    );
  });

  it("avoids the reported F01 queen blunder and the opponent's immediate mating reply", () => {
    const original = fromFEN("1n1r2k1/pq4pp/1p1r1pb1/1R1P4/PB6/1Q2N3/5PPP/R5K1 b - - 0 1");
    expect(searchNext(original, [], fixed).move).not.toMatchObject({
      from: sqIndex("b7"),
      to: sqIndex("d5"),
    });
    const fool = fromFEN("rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2");
    const result = searchNext(fool, [], fixed);
    expect(result.move).not.toMatchObject({ from: sqIndex("g2"), to: sqIndex("g4") });
    expect(
      result.candidates.find((c) => c.move.from === sqIndex("g2") && c.move.to === sqIndex("g4"))
        ?.score,
    ).toBeLessThan(-90000);
  });

  it("completes forcing refinements and retains depth two when depth three is interrupted", () => {
    const position = fromFEN("1r5k/8/8/8/8/8/P7/K7 w - - 0 1");
    const complete = searchNext(position, [], { ...fixed, baselineOnly: false });
    expect(complete.phase).toBe("forcing");
    expect(complete.interruption).toBeNull();
    const interrupted = searchNext(position, [], {
      ...fixed,
      baselineOnly: false,
      maxDepth: 3,
      maxNodes: complete.nodes + 1,
    });
    expect(interrupted.phase).toBe("forcing");
    expect(interrupted.attemptedDepth).toBe(3);
    expect(interrupted.candidates).toEqual(complete.candidates);
    const capped = searchNext(position, [], {
      ...fixed,
      baselineOnly: false,
      forcingSafetyPlies: 0,
    });
    expect(capped.interruption).toBe("forcing-limit");
    expect(capped.phase).toBe("baseline");
    expect(capped.candidates).toEqual(searchNext(position, [], fixed).candidates);
  });

  it("matches an exhaustive same-policy oracle for every root at depths two and three, both colors", () => {
    for (const fen of ["1r5k/8/8/8/8/8/P7/K7 w - - 0 1", "k7/p7/8/8/8/8/8/1R5K b - - 0 1"])
      for (const depth of [2, 3]) {
        const p = fromFEN(fen);
        const result = searchNext(p, [], { ...fixed, baselineOnly: false, maxDepth: depth });
        expect(result.phase).toBe("forcing");
        expect(result.depth).toBe(depth);
        expect(result.interruption).toBeNull();
        for (const candidate of result.candidates) {
          const score =
            -oracle(applyMove(p, candidate.move), depth - 1, [posKey(p)], 1) *
            (p.turn === "w" ? 1 : -1);
          if (candidate.kind === "exact") expect(candidate.score).toBe(score === 0 ? 0 : score);
          else if (candidate.kind === "upper-bound")
            expect(score).toBeLessThanOrEqual(candidate.score);
          else expect(score).toBeGreaterThanOrEqual(candidate.score);
        }
      }
  });

  it("recognizes descendant repetition and restores history between siblings and iterations", () => {
    let p = fromFEN("4k1n1/8/8/8/8/8/8/4K1N1 w - - 0 1");
    const history: string[] = [];
    for (const [from, to] of [
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
    ]) {
      history.push(toFEN(p));
      p = applyMove(
        p,
        legalMoves(p).find((move) => move.from === sqIndex(from) && move.to === sqIndex(to))!,
      );
    }
    const result = searchNext(p, history, { ...fixed, baselineOnly: false, maxDepth: 3 });
    expect(result.phase).toBe("forcing");
    expect(result.depth).toBe(3);
    expect(
      result.candidates.find((c) => c.move.from === sqIndex("f6") && c.move.to === sqIndex("g8"))
        ?.score,
    ).toBe(0);
    for (const candidate of result.candidates) {
      const score = oracle(
        applyMove(p, candidate.move),
        2,
        [...history.map((fen) => posKey(fromFEN(fen))), posKey(p)],
        1,
      );
      if (candidate.kind === "exact") expect(candidate.score).toBe(score === 0 ? 0 : score);
      else if (candidate.kind === "upper-bound") expect(score).toBeLessThanOrEqual(candidate.score);
      else expect(score).toBeGreaterThanOrEqual(candidate.score);
    }
  });
});
