import { describe, expect, it } from "vitest";
import {
  START,
  applyMove,
  fromFEN,
  inCheck,
  legalMoves,
  posKey,
  sanFor,
} from "../../../src/engine/board";
import {
  agreement,
  assertMode,
  buildDataset,
  classifyChoice,
  splitFor,
  wholeGameId,
  type AgreementRow,
} from "../../../scripts/engine-bench/core";
import { CURATED } from "../../../scripts/engine-bench/fixtures";
import type { RosterGame } from "../../../scripts/roster-history/corpus";
const game = (moves: string[], id = "arbitrary"): RosterGame => ({
  id,
  white: "A",
  black: "B",
  date: "",
  site: "",
  rosterColor: "w",
  moves,
});
const line = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3".split(" ");
function moveSan(fen: string, san: string) {
  const p = fromFEN(fen);
  const move = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === san);
  if (!move) throw Error(`Missing move ${san}`);
  return applyMove(p, move);
}
describe("E0 frozen benchmark foundation", () => {
  it("splits canonical whole games and ignores source aliases and ordering", () => {
    const a = game(line, "first"),
      b = { ...a, id: "renamed", rosterColor: "b" as const };
    expect(buildDataset([a, b], 1)).toEqual(buildDataset([b, a], 1));
    expect(buildDataset([a, b], 1).games).toBe(1);
    const rows = buildDataset([a], 1).samples;
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((s) => s.split))).toEqual(new Set([splitFor(wholeGameId(line))]));
    for (const row of rows) expect(row.history.length).toBe(row.ply);
  });
  it("quarantines shared transpositions across splits even if clocks differ", () => {
    // Legally extend one game to find the opposite hash-assigned split.
    const a = game(line),
      target = splitFor(wholeGameId(line));
    let b: RosterGame | undefined;
    let position = START();
    for (const san of line) {
      const move = legalMoves(position).find(
        (m) => sanFor(position, m, applyMove(position, m)) === san,
      )!;
      position = applyMove(position, move);
    }
    for (const move of legalMoves(position)) {
      const candidate = game([...line, sanFor(position, move, applyMove(position, move))]);
      if (splitFor(wholeGameId(candidate.moves)) !== target) {
        b = candidate;
        break;
      }
    }
    expect(b).toBeDefined();
    const result = buildDataset([a, b!], 1);
    const short = buildDataset([a], 1).samples;
    expect(result.quarantinedKeys).toBeGreaterThan(0);
    expect(result.samples.some((s) => short.some((t) => t.key === s.key))).toBe(false);
    const p = START(),
      q = { ...p, halfmove: 45, fullmove: 19 };
    expect(posKey(p)).toBe(posKey(q));
    expect(posKey({ ...p, castling: { ...p.castling, K: false } })).not.toBe(posKey(p));
  });
  it("rejects illegal source histories and invalid sampling intervals", () => {
    expect(() => buildDataset([game(["e5"])])).toThrow();
    expect(() => buildDataset([], 0)).toThrow();
  });
  it("requires completed comparable alternatives to identify genuine choices", () => {
    expect(classifyChoice(1, [], 0)).toBe("forced-legal");
    expect(classifyChoice(3, [10, 0], 2)).toBe("uncertain");
    expect(classifyChoice(3, [10, 0, -150], 1)).toBe("uncertain");
    expect(classifyChoice(3, [10, 0, -150], 2)).toBe("genuine-choice");
    expect(classifyChoice(3, [10, -50, -150], 2)).toBe("single-credible");
    expect(classifyChoice(2, [99999, 99999], 2)).toBe("uncertain");
  });
  it("keeps clock modes separate and rejects missing or duplicated opponents", () => {
    const rows: AgreementRow[] = ["classic", "morphy", "chigorin", "spassky", "tal", "fischer"].map(
      (opponent, i) => ({
        sampleId: "s",
        level: "club",
        seed: 317,
        mode: "production-elapsed",
        opponent,
        move: i < 3 ? "a" : "b",
        choice: "genuine-choice",
      }),
    );
    expect(agreement(rows)).toMatchObject({ pairs: 15, equal: 6, choicePairs: 15, choiceEqual: 6 });
    const fixed = rows.map((r) => ({
      ...r,
      mode: "fixed-completed-policy" as const,
      choice: "forced-legal" as const,
      move: "a",
    }));
    expect(agreement([...rows, ...fixed])).toMatchObject({
      pairs: 30,
      equal: 21,
      choicePairs: 15,
      choiceEqual: 6,
    });
    expect(() => agreement(rows.slice(1))).toThrow("Incomplete");
    expect(() => agreement([...rows, rows[0]])).toThrow("Duplicate");
    expect(() => assertMode("fake-clock-nodes")).toThrow();
  });
  it("checks the authored fixture properties by legal moves, not expected engine choices", () => {
    const quiet = fromFEN(CURATED[0].fen);
    expect(inCheck(quiet, quiet.turn)).toBe(false);
    expect(legalMoves(quiet).length).toBeGreaterThanOrEqual(10);
    const defensive = fromFEN(CURATED[1].fen);
    expect(inCheck(defensive, defensive.turn)).toBe(true);
    expect(legalMoves(defensive)).toHaveLength(1);
    expect(() => moveSan(CURATED[1].fen, "Kg8")).not.toThrow();
    const winning = fromFEN(CURATED[2].fen);
    expect(
      legalMoves(winning).some((m) => {
        const next = applyMove(winning, m);
        return inCheck(next, next.turn) && legalMoves(next).length === 0;
      }),
    ).toBe(true);
    const ending = fromFEN(CURATED[3].fen);
    expect(ending.board.filter(Boolean)).toHaveLength(3);
    expect(inCheck(ending, ending.turn)).toBe(false);
    expect(legalMoves(ending).length).toBeGreaterThan(1);
    const trap = moveSan(CURATED[4].fen, "Qxd5");
    const reply = legalMoves(trap).find((m) => sanFor(trap, m, applyMove(trap, m)) === "cxd5")!;
    expect(reply).toBeDefined();
    expect(applyMove(trap, reply).board.filter((p) => p?.startsWith("w"))).toEqual(["wk"]);
  });
});
