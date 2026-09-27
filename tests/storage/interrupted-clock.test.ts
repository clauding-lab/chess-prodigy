import { expect, it } from "vitest";
import { freshSession, reduceSession, markEngineInterruption } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { saveState, loadSavedState, SAVE_KEY } from "../../src/storage/store";
import { encodeCompactSession, decodeCompactSession } from "../../src/storage/compact";
function computerTurn() {
  let s = reduceSession(freshSession(0, "seed"), {
    type: "new",
    id: "timed",
    now: 0,
    setup: { playerColor: "w", level: "club", time: "5+0" },
  });
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s.game.clocks = { w: 300000, b: 100 };
  return s;
}
it("loads a closed timed computer turn as an unrated timeout before two reloads", () => {
  localStorage.clear();
  const source = computerTurn();
  expect(saveState(localStorage, source)).toBe(true);
  const first = loadSavedState(localStorage, 1000, "fallback").session;
  expect(first.game.over?.reason).toBe("Time out");
  expect(first.game.unratedReason).toBe("engine-interrupted");
  expect(first.game.ratingApplied).toBeNull();
  expect(first.rating).toEqual(source.rating);
  expect(saveState(localStorage, first)).toBe(true);
  expect(loadSavedState(localStorage, 2000, "fallback").session).toEqual(first);
});
it("round trips interruption provenance and rejects stale or malformed context", () => {
  const source = computerTurn();
  source.game = markEngineInterruption(source.game, "worker-failure", 50);
  const compact = encodeCompactSession(source);
  expect(decodeCompactSession(compact)?.game.engineInterruption).toEqual(
    source.game.engineInterruption,
  );
  for (const patch of [{ ply: 99 }, { turn: "w" }, { at: Infinity }, { cause: "invented" }]) {
    const poisoned = structuredClone(compact);
    poisoned.game.engineInterruption = { ...source.game.engineInterruption!, ...patch } as never;
    expect(decodeCompactSession(poisoned)).toBeNull();
  }
});
it("never changes an existing rated timeout receipt on loading", () => {
  localStorage.clear();
  const ended = reduceSession(computerTurn(), { type: "tick", now: 1000 });
  expect(ended.game.ratingApplied).not.toBeNull();
  localStorage.setItem(SAVE_KEY, JSON.stringify(encodeCompactSession(ended)));
  const loaded = loadSavedState(localStorage, 2000, "fallback").session;
  expect(loaded.game.ratingApplied).toEqual(ended.game.ratingApplied);
  expect(loaded.rating).toEqual(ended.rating);
});
