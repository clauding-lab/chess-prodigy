import { expect, it } from "vitest";
import { fromFEN, legalMoves, applyMove, sanFor } from "../../src/engine/board";
import { freshGame, freshSession, reduceGame, reduceSession } from "../../src/game/state";
import { playLine } from "./play-line";

it("settles production threefold once and undo removes exactly the traversed repetition counts", () => {
  const cycle = ["Nf3", "Nf6", "Ng1", "Ng8"];
  const repeated = playLine(freshSession(0, "repetition"), [...cycle, ...cycle], 1);
  expect(repeated.game.over).toEqual({ result: "½-½", reason: "Threefold repetition" });
  expect(repeated.rating.games).toBe(1);
  expect(reduceSession(repeated, { type: "tick", now: 2 }).rating).toEqual(repeated.rating);
  const undone = reduceSession(repeated, { type: "undo", now: 3 });
  expect(undone.game.hist).toHaveLength(6);
  expect(undone.rating.games).toBe(0);
  expect(undone.game.over).toBeNull();
  const redrawn = playLine(undone, ["Ng1", "Ng8"], 4);
  expect(redrawn.game.over?.reason).toBe("Threefold repetition");
  expect(redrawn.rating.games).toBe(0);
});

it.each([
  ["4k3/8/8/8/8/8/8/R3K3 w - - 99 80", "Ra2", "Fifty-move rule"],
  ["7k/8/5KQ1/8/8/8/8/8 w - - 99 80", "Qg7#", "Checkmate"],
  ["7k/5K2/8/6Q1/8/8/8/8 w - - 0 1", "Qg6", "Stalemate"],
  ["4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "Bd2", "Insufficient material"],
])("classifies %s after %s as %s in the production reducer", (fen, san, reason) => {
  const game = freshGame({ playerColor: "w", level: "club", time: "none" }, 0, "rule");
  game.st = fromFEN(fen);
  const move = legalMoves(game.st).find(
    (move) => sanFor(game.st, move, applyMove(game.st, move)) === san,
  );
  expect(move, `fixture SAN ${san}`).toBeDefined();
  const ended = reduceGame(game, { type: "move", move: move!, book: false, now: 1 });
  expect(ended.over?.reason).toBe(reason);
});
