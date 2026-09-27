import { expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { encodeCompactSession, decodeCompactSession } from "../../src/storage/compact";
import { playLine, FOOLS_MATE } from "./play-line";

it("never awards or reverses rating for a completed temporary session", () => {
  const initial = freshSession(0, "temporary");
  initial.game.rated = false;
  initial.game.unratedReason = "temporary-session";
  const terminal = playLine(initial, FOOLS_MATE, 1);
  expect(terminal.game.over?.reason).toBe("Checkmate");
  expect(terminal.game.ratingApplied).toBeNull();
  expect(terminal.rating).toEqual(initial.rating);
  expect(decodeCompactSession(encodeCompactSession(terminal))?.game.unratedReason).toBe(
    "temporary-session",
  );
  expect(reduceSession(terminal, { type: "undo", now: 10 }).rating).toEqual(initial.rating);
});
