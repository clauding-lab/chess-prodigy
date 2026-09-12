import { expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { CLASSIC, morphyConfig } from "../../src/engine/opponents";
import { parseSavedState } from "../../src/storage/schema";
import { loadSavedState, saveState, SAVE_KEY, PREVIOUS_SAVE_KEY } from "../../src/storage/store";

function legacy() {
  let s = freshSession(0, "legacy");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  const wire = JSON.parse(JSON.stringify(s));
  wire.version = 1;
  delete wire.game.opponent;
  delete wire.game.unratedReason;
  delete wire.game.takebackUsed;
  return wire;
}
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}

it("migrates v1 to deterministic Classic metadata preserving the receipt, game and rating", () => {
  const wire = legacy(),
    s = parseSavedState(wire)!;
  expect(s.version).toBe(2);
  expect(s.game).toMatchObject({ opponent: CLASSIC, unratedReason: null, takebackUsed: false });
  expect(s.rating).toEqual(wire.rating);
  expect(s.game.ratingApplied).toEqual(wire.game.ratingApplied);
  expect(s.game.hist).toEqual(wire.game.hist);
  expect(parseSavedState(wire)).toEqual(s);
  expect(parseSavedState(s)).toEqual(s);
  wire.game.rated = false;
  wire.game.ratingApplied = null;
  expect(parseSavedState(wire)!.game).toMatchObject({
    takebackUsed: null,
    unratedReason: "legacy-unrated",
  });
});

it("does not relabel supplied newer opponent fields as Classic under a legacy schema tag", () => {
  const wire = legacy();
  wire.game.opponent = morphyConfig(42);
  const raw = JSON.stringify(wire),
    storage = new MemoryStorage();
  storage.setItem(PREVIOUS_SAVE_KEY, raw);
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
  expect(storage.getItem(PREVIOUS_SAVE_KEY)).toBe(raw);
});

it("isolates newer saves from stale v1 writes and preserves the original legacy bytes", () => {
  const storage = new MemoryStorage(),
    raw = JSON.stringify(legacy());
  storage.setItem(PREVIOUS_SAVE_KEY, raw);
  const migrated = loadSavedState(storage, 3, "fallback");
  expect(migrated.session.game.id).toBe("legacy");
  expect(migrated.session.version).toBe(2);
  expect(saveState(storage, migrated.session)).toBe(true);
  expect(storage.getItem(PREVIOUS_SAVE_KEY)).toBe(raw);
  storage.setItem(
    PREVIOUS_SAVE_KEY,
    JSON.stringify({ ...legacy(), game: { ...legacy().game, id: "stale-tab" } }),
  );
  expect(loadSavedState(storage, 4, "fallback").session.game.id).toBe("legacy");
  storage.setItem(SAVE_KEY, "corrupt-newer");
  expect(loadSavedState(storage, 4, "fallback").status).toBe("corrupt");
  expect(storage.getItem(SAVE_KEY)).toBe("corrupt-newer");
});

it("roundtrips supported beta and retains unknown version metadata without substitution", () => {
  const s = freshSession(0, "beta");
  s.game.opponent = morphyConfig(1234);
  s.game.rated = false;
  s.game.unratedReason = "beta";
  expect(parseSavedState(s)).toEqual(s);
  s.game.opponent.version = 99;
  const storage = new MemoryStorage();
  const raw = JSON.stringify(s);
  storage.setItem(SAVE_KEY, raw);
  expect(loadSavedState(storage, 999999, "fallback").session).toEqual(s);
  expect(storage.getItem(SAVE_KEY)).toBe(raw);
  expect(parseSavedState({ ...s, version: 3 })).toBeNull();
});

it("invalidates untrusted review data even for an unavailable read-only opponent", () => {
  const s = freshSession(0, "future");
  const moved = reduceSession(s, {
    type: "move",
    move: legalMoves(s.game.st)[0],
    book: false,
    now: 1,
  });
  moved.game.opponent.version = 99;
  moved.game.evals[0] = { score: 8888, best: legalMoves(s.game.st)[0] };
  moved.game.hist[0].ann = "!";
  moved.game.hist[0].better = "d4";
  const storage = new MemoryStorage(),
    raw = JSON.stringify(moved);
  storage.setItem(SAVE_KEY, raw);
  const parsed = loadSavedState(storage, 2, "fallback").session;
  expect(parsed.game.opponent.version).toBe(99);
  expect(parsed.game.evals).toEqual({});
  expect(parsed.game.hist[0]).toMatchObject({ ann: null, better: null });
  expect(storage.getItem(SAVE_KEY)).toBe(raw);
});

it("isolates measured guest progress from late writes by the previous app while retaining its bytes", () => {
  const storage = new MemoryStorage(),
    old = JSON.stringify(freshSession(0, "old-beta-app"));
  storage.setItem("chess-prodigy-state-v2", old);
  const migrated = loadSavedState(storage, 0, "fallback").session;
  expect(migrated.game.id).toBe("old-beta-app");
  const next = { ...migrated, game: { ...migrated.game, id: "new-app" } };
  expect(saveState(storage, next)).toBe(true);
  expect(storage.getItem("chess-prodigy-state-v2")).toBe(old);
  storage.setItem("chess-prodigy-state-v2", JSON.stringify(freshSession(1, "stale-tab")));
  expect(loadSavedState(storage, 2, "fallback").session.game.id).toBe("new-app");
  storage.setItem(SAVE_KEY, "broken-current");
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
});
