import { expect, it } from "vitest";
import { fromFEN, insufficientMaterial } from "../../src/engine/board";
import { isDeadPositionV2 } from "../../src/engine/rules-v2";
import { applyHumanDeadPositionRule } from "../../server/human-rules";
import { freshGame } from "../../src/game/state";

it("recognizes any number of bishops confined to the same square color, for either owner", () => {
  for (const fen of [
    "7k/8/8/8/8/4B3/8/K1B5 w - - 0 1",
    "7k/8/8/8/8/4b3/8/K1b5 w - - 0 1",
    "7k/8/8/8/5b2/4B3/8/K1B5 w - - 0 1",
  ]) {
    const board = fromFEN(fen).board;
    expect(insufficientMaterial(board)).toBe(false);
    expect(isDeadPositionV2(board)).toBe(true);
  }
});

it("does not confuse inability to force mate with impossibility of any legal mate", () => {
  for (const fen of [
    "7k/8/8/8/8/3B4/8/K1B5 w - - 0 1", // opposite square colors
    "7k/8/8/8/8/4N3/8/K1B5 w - - 0 1",
    "7k/8/8/8/8/4n3/8/K1B5 w - - 0 1",
    "7k/8/8/8/8/4P3/8/K1B5 w - - 0 1",
    "7k/8/8/8/8/4N3/8/K1N5 w - - 0 1",
  ])
    expect(isDeadPositionV2(fromFEN(fen).board)).toBe(false);
});

it("changes only new human rule versions and preserves existing terminal results", () => {
  const game = {
    ...freshGame({ playerColor: "w", level: "club", time: "none" }, 0, "human"),
    st: fromFEN("7k/8/8/8/8/4B3/8/K1B5 w - - 0 1"),
  };
  expect(applyHumanDeadPositionRule(game, 1)).toBe(game);
  expect(applyHumanDeadPositionRule(game, 2).over).toEqual({
    result: "½-½",
    reason: "Insufficient material",
  });
  const ended = { ...game, over: { result: "1-0" as const, reason: "Resignation" } };
  expect(applyHumanDeadPositionRule(ended, 2)).toBe(ended);
  expect(() => applyHumanDeadPositionRule(game, 3)).toThrow("Unsupported human rules");
});
