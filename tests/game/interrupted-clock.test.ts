import { expect, it } from "vitest";
import { legalMoves } from "../../src/engine/board";
import { freshSession, reduceSession } from "../../src/game/state";
import type { Session } from "../../src/game/types";

function pending(playerColor: "w" | "b" = "w"): Session {
  let s = reduceSession(freshSession(1000, "initial"), {
    type: "new",
    setup: { playerColor, level: "club", time: "5+0" },
    now: 1000,
    id: "clock",
  });
  for (let i = 0; i < (playerColor === "w" ? 1 : 2); i++)
    s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1000 });
  s.game.clocks = { w: 1000, b: 1000 };
  return s;
}

it.each(["w", "b"] as const)("excludes interrupted computer timeout for human %s", (color) => {
  const s = pending(color);
  Object.assign(s.game, {
    engineInterruption: {
      ply: s.game.hist.length,
      turn: s.game.st.turn,
      at: 1100,
      cause: "closed",
    },
  });
  const next = reduceSession(s, { type: "tick", now: 2000 });
  expect(next.game.over?.reason).toBe("Time out");
  expect(next.game.rated).toBe(false);
  expect(next.game.unratedReason).toBe("engine-interrupted");
  expect(next.game.ratingApplied).toBeNull();
  expect(next.rating).toEqual(s.rating);
});
it("keeps normal computer timeout receipt unchanged by late interruption", () => {
  const s = reduceSession(pending(), { type: "tick", now: 2000 });
  expect(s.game.ratingApplied).not.toBeNull();
  const next = reduceSession(s, {
    type: "engineInterruption",
    gameId: s.game.id,
    ply: s.game.hist.length,
    cause: "worker-failure",
    now: 2100,
  });
  expect(next).toBe(s);
});
it("clears turn provenance only after a legal move or undo", () => {
  const s = pending();
  Object.assign(s.game, {
    engineInterruption: { ply: 1, turn: "b", at: 1100, cause: "worker-failure" },
  });
  const next = reduceSession(s, {
    type: "move",
    move: legalMoves(s.game.st)[0],
    book: false,
    now: 1200,
  });
  expect(next.game).not.toHaveProperty("engineInterruption", expect.anything());
  expect(next.game.rated).toBe(true);
  const undo = reduceSession(s, { type: "undo", now: 1200 });
  expect(undo.game).not.toHaveProperty("engineInterruption", expect.anything());
});

it("ignores stale identities and preserves the first interruption cause", () => {
  const s = pending();
  const action = {
    type: "engineInterruption" as const,
    gameId: s.game.id,
    ply: 1,
    cause: "worker-failure" as const,
    now: 1100,
  };
  expect(reduceSession(s, { ...action, gameId: "old" })).toBe(s);
  expect(reduceSession(s, { ...action, ply: 0 })).toBe(s);
  const marked = reduceSession(s, action);
  expect(marked.game.revision).toBe(s.game.revision);
  expect(marked.game.engineInterruption?.cause).toBe("worker-failure");
  expect(reduceSession(marked, { ...action, cause: "closed", now: 1200 })).toBe(marked);
});
