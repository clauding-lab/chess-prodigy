import { expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import type { Session } from "../../src/game/types";

function play(session: Session, san: string, now: number) {
  const move = legalMoves(session.game.st).find(
    (move) => sanFor(session.game.st, move, applyMove(session.game.st, move)) === san,
  )!;
  return reduceSession(session, { type: "move", move, book: false, now });
}

it.each(["resign", "forfeit", "tick"] as const)(
  "does not undo %s or reverse its receipt",
  (type) => {
    let session = freshSession(0, type);
    if (type === "tick") {
      session.game.setup.time = "5+0";
      session.game.clocks = { w: 300000, b: 300000 };
    }
    session = play(session, "e4", 1);
    session = reduceSession(session, { type, now: 400000 });
    expect(session.game.over).not.toBeNull();
    expect(session.rating.games).toBe(1);
    expect(reduceSession(session, { type: "undo", now: 400001 })).toBe(session);
  },
);

it("allows a checkmate takeback and reverses only that receipt once", () => {
  let session = freshSession(0, "mate");
  for (const san of ["f3", "e5", "g4", "Qh4#"]) session = play(session, san, 1);
  expect(session.game.over?.reason).toBe("Checkmate");
  expect(session.rating.games).toBe(1);
  session = reduceSession(session, { type: "undo", now: 2 });
  expect(session.game.over).toBeNull();
  expect(session.game.rated).toBe(false);
  expect(session.rating.games).toBe(0);
  expect(reduceSession(session, { type: "undo", now: 3 }).rating.games).toBe(0);
});

it("settles an expired clock before undo even when no display tick ran", () => {
  let session = freshSession(0, "late-undo");
  session.game.setup.time = "5+0";
  session.game.clocks = { w: 300000, b: 300000 };
  session = play(session, "e4", 1);
  const ended = reduceSession(session, { type: "undo", now: 400000 });
  expect(ended.game.over?.reason).toBe("Time out");
  expect(ended.game.hist).toEqual(session.game.hist);
  expect(ended.rating.games).toBe(1);
  expect(ended.game.takebackUsed).toBe(false);
});
