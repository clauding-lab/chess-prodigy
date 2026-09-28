import { expect, it } from "vitest";
import { freshSession, reduceSession, reduceGame } from "../../src/game/state";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { parseSessionInput } from "../../src/storage/input";
import { encodeCompactSession } from "../../src/storage/compact";
import { playLine } from "../game/play-line";

it("full and compact experimental saves reject legal-looking moves after a terminal draw", () => {
  const initial = reduceSession(freshSession(0, "old"), {
    type: "new",
    id: "experiment",
    now: 1,
    setup: {
      playerColor: "w",
      level: "club",
      time: "none",
      opponent: experimentalRosterConfig("tal", 11),
    },
  });
  const drawn = playLine(initial, ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"], 2);
  expect(drawn.game.over?.reason).toBe("Threefold repetition");
  expect(parseSessionInput(drawn)).not.toBeNull();
  expect(parseSessionInput(encodeCompactSession(drawn))).not.toBeNull();
  const move = legalMoves(drawn.game.st).find(
    (m) => sanFor(drawn.game.st, m, applyMove(drawn.game.st, m)) === "e4",
  )!;
  // Deliberately forge an otherwise legal continuation by clearing its terminal marker.
  const corrupt = {
    ...drawn,
    game: reduceGame({ ...drawn.game, over: null }, { type: "move", move, book: false, now: 20 }),
  };
  expect(corrupt.game.hist).toHaveLength(9);
  expect(parseSessionInput(corrupt)).toBeNull();
  expect(parseSessionInput(encodeCompactSession(corrupt))).toBeNull();
});
