import { describe, expect, it } from "vitest";
import {
  START,
  applyMove,
  fromFEN,
  legalMoves,
  posKey,
  sanFor,
  sqIndex,
  toFEN,
} from "../../src/engine/board";
import type { Position } from "../../src/engine/types";

function perft(position: Position, depth: number): number {
  return depth === 0
    ? 1
    : legalMoves(position).reduce((n, move) => n + perft(applyMove(position, move), depth - 1), 0);
}

describe("FEN and rules", () => {
  it("round-trips the starting position", () =>
    expect(toFEN(fromFEN(toFEN(START())))).toBe(toFEN(START())));
  it.each([
    "8/8/8/8/8/8/8/8 w - - 0 1",
    "not a position",
    "4k3/8/8/8/8/8/8/4K3 x - - 0 1",
    "4k3/8/8/8/8/8/8/4K3 w KK - 0 1",
    "4k3/8/8/8/8/8/8/4K3 w K - 0 1",
    "4k3/8/8/8/8/8/8/4K3 w - e4 0 1",
  ])("rejects invalid FEN %s", (fen) => expect(() => fromFEN(fen)).toThrow());
  it("preserves a structurally possible raw en-passant target", () => {
    const fen = "4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1";
    expect(toFEN(fromFEN(fen))).toBe(fen);
  });
  it.each([
    ["start", START(), [20, 400, 8902]],
    [
      "Kiwipete",
      fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"),
      [48, 2039],
    ],
    ["position 3", fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), [14, 191, 2812]],
  ] as const)("matches %s perft", (_name, position, counts) =>
    expect(counts.map((_, i) => perft(position, i + 1))).toEqual(counts),
  );
  it("disallows castling through check", () =>
    expect(legalMoves(fromFEN("4kr2/8/8/8/8/8/8/4K2R w K - 0 1")).some((move) => move.castle)).toBe(
      false,
    ));
  it("generates all promotion choices", () => {
    const position = fromFEN("7k/P7/8/8/8/8/8/4K3 w - - 0 1");
    expect(
      legalMoves(position)
        .filter((move) => move.from === sqIndex("a7"))
        .map((move) => move.promo),
    ).toEqual(["q", "r", "b", "n"]);
  });
});

describe("position identity and SAN", () => {
  it("keeps only legal en passant in the repetition key", () => {
    const legal = fromFEN("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(posKey(legal)).not.toBe(posKey({ ...legal, ep: null }));
    const pinned = fromFEN("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(posKey(pinned)).toBe(posKey({ ...pinned, ep: null }));
    expect(toFEN(pinned)).toContain(" d6 ");
  });
  it.each([
    ["1n2k3/8/5n2/8/8/8/8/4K3 b - - 0 1", "d7", "Nbd7"],
    ["4k3/8/8/8/8/8/3N4/4K1N1 w - - 0 1", "f3", "Ngf3"],
    ["7k/2N5/8/8/3N4/8/8/4K3 w - - 0 1", "b5", "Ndb5"],
  ])("emits disambiguated SAN", (fen, target, san) => {
    const position = fromFEN(fen);
    expect(
      legalMoves(position).some(
        (move) =>
          move.to === sqIndex(target) && sanFor(position, move, applyMove(position, move)) === san,
      ),
    ).toBe(true);
  });
  it("marks checkmate", () => {
    const position = fromFEN("7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
    expect(
      legalMoves(position).some((move) =>
        sanFor(position, move, applyMove(position, move)).endsWith("#"),
      ),
    ).toBe(true);
  });
});
