import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyMove, fromFEN, legalMoves, sanFor } from "../../src/engine/board";
import { MOTIFS, MOTIF_ORDER, detectMotifs } from "../../src/coach/motifs";

function motifs(fen: string, san: string, reason: string | null = null) {
  const before = fromFEN(fen);
  const move = legalMoves(before).find(
    (candidate) => sanFor(before, candidate, applyMove(before, candidate)) === san,
  );
  expect(move, `${san} must be legal`).toBeDefined();
  return detectMotifs(before, move!, applyMove(before, move!), reason ? { reason } : null).map(
    ({ key }) => key,
  );
}

describe("motif catalogue", () => {
  it("contains all 27 cards in display order", () => {
    expect(MOTIF_ORDER).toHaveLength(27);
    expect(Object.keys(MOTIFS).sort()).toEqual([...MOTIF_ORDER].sort());
    for (const card of Object.values(MOTIFS))
      expect(card).toMatchObject({
        name: expect.any(String),
        kind: expect.any(String),
        origin: expect.any(String),
        plan: expect.any(String),
      });
  });

  it("preserves every supplied motif card verbatim", () => {
    const source = fs.readFileSync(path.resolve("reference/chess-app.jsx"), "utf8");
    const start = source.indexOf("const MOTIFS = {");
    const end = source.indexOf("\n};", start) + 3;
    const literal = source.slice(start, end).replace("const MOTIFS =", "return");
    expect(MOTIFS).toEqual(new Function(literal)());
  });

  it.each([
    ["doublecheck", "4k3/8/8/8/8/8/4B3/4RK2 w - - 0 1", "Bb5+"],
    ["promotion", "7k/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=Q+"],
    ["underpromotion", "7k/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=N"],
    ["castle", "4k3/8/8/8/8/8/8/4K2R w K - 0 1", "O-O"],
    ["castleQ", "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "O-O-O"],
    ["enpassant", "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6"],
    ["check", "7k/8/8/8/8/8/4R3/4K3 w - - 0 1", "Re8+"],
    ["fianchetto", "4k3/8/8/8/8/6P1/8/4KB2 w - - 0 1", "Bg2"],
    ["duo", "4k3/8/8/8/3P4/8/4P3/4K3 w - - 0 1", "e4"],
    ["openfile", "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "Rd1"],
    ["seventh", "4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "Ra7"],
    ["iqp", "4k3/8/8/3n4/2P5/8/8/4K3 w - - 0 1", "cxd5"],
    ["passed", "4k3/8/1p6/P7/8/8/8/4K3 w - - 0 1", "axb6"],
    ["minority", "4k3/8/2p5/8/1P6/8/8/4K3 w - - 0 1", "b5"],
    ["bishops", "k6b/8/8/8/8/8/3b4/2B1KB2 w - - 0 1", "Bxd2"],
  ])("detects %s on a legal move", (key, fen, san) => expect(motifs(fen, san)).toContain(key));

  it("does not report a structural motif that was already present", () => {
    expect(motifs("4k3/8/8/8/3PP3/8/8/4K3 w - - 0 1", "d5")).not.toContain("duo");
  });

  it("does not report doubling when a capture leaves one pawn per file", () => {
    expect(motifs("4k3/8/8/3n4/2P1P3/8/8/4K3 w - - 0 1", "exd5")).not.toContain("doubled");
  });

  it.each(MOTIF_ORDER)("does not invent %s on a quiet developing move", (key) => {
    expect(motifs("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Na3")).not.toContain(
      key,
    );
  });

  it("matches the 12 supplied handoff fixtures", () => {
    const handoff = fs.readFileSync(path.resolve("CODEX_HANDOFF.md"), "utf8");
    const rows = handoff.split("\n").filter((line) => line.startsWith("| `"));
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const [, rawFen, san, expected] = row.split("|").map((cell) => cell.trim());
      const keys = motifs(rawFen.replaceAll("`", ""), san, san.endsWith("#") ? "Checkmate" : null);
      if (expected.startsWith("*no fork*")) expect(keys, san).not.toContain("fork");
      else for (const key of expected.split(" (")[0].split(", ")) expect(keys, san).toContain(key);
    }
  });
});

it.each([
  ["discovered", "7k/8/5q2/8/8/2Q5/8/B6K w - - 0 1", "Qb2", false],
  ["discovered", "4k3/8/8/8/8/4B3/8/4R1K1 w - - 0 1", "Bd4+", true],
  ["sacrifice", "1r5k/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=Q", false],
  ["sacrifice", "1r5k/8/8/8/8/8/3Q4/4K3 w - - 0 1", "Qb2+", true],
  ["sacrifice", "4k3/4n3/8/8/8/8/3Q4/4R1K1 w - - 0 1", "Qd5", false],
  ["doubled", "4k3/8/8/3n4/2P5/3P4/8/4K3 w - - 0 1", "cxd5", true],
  ["doubled", "4k3/8/8/3n4/2P5/2P5/8/4K3 w - - 0 1", "cxd5", false],
  ["doubled", "4k3/8/8/3n4/2P5/2P5/2P5/4K3 w - - 0 1", "cxd5", false],
  ["doubled", "4k3/8/8/3n4/2P5/3P3P/7P/4K3 w - - 0 1", "cxd5", true],
  ["backrank", "7k/8/6K1/8/8/8/8/R7 w - - 0 1", "Ra8#", false],
  ["backrank", "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "Ra8#", true],
])("R11 %s: %s %s => %s", (key, fen, san, present) => {
  const keys = motifs(fen as string, san as string, key === "backrank" ? "Checkmate" : null);
  expect(keys.includes(key as (typeof keys)[number])).toBe(present);
});
