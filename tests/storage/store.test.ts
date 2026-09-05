import { it, expect } from "vitest";
import { loadSavedState, saveState, SAVE_KEY, LEGACY_KEY } from "../../src/storage/store";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { defaultRating } from "../../src/rating/fide";
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
it("roundtrips a legal game, its preferences and exactly-once rating receipt", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  expect(saveState(storage, s)).toBe(true);
  const restored = loadSavedState(storage, 3, "fallback");
  expect(restored.status).toBe("saved");
  expect(restored.session.game.hist).toHaveLength(1);
  expect(restored.session.rating.games).toBe(1);
  expect(reduceSession(restored.session, { type: "tick", now: 4 }).rating.games).toBe(1);
});
it("rejects corrupt saves without overwriting them", () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, "{broken");
  const result = loadSavedState(storage, 0, "one");
  expect(result.status).toBe("corrupt");
  expect(storage.getItem(SAVE_KEY)).toBe("{broken");
});
it("rejects forged boards and nonfinite ratings", () => {
  const storage = new MemoryStorage();
  const s = freshSession(0, "one");
  s.game.st.board[0] = null;
  storage.setItem(SAVE_KEY, JSON.stringify(s));
  expect(loadSavedState(storage, 0, "fallback").status).toBe("corrupt");
  s.rating.rating = Infinity;
  storage.setItem(SAVE_KEY, JSON.stringify(s));
  expect(loadSavedState(storage, 0, "fallback").status).toBe("corrupt");
  const huge = freshSession(0, "huge");
  huge.rating.rating = 1e100;
  huge.rating.peak = 1e100;
  storage.setItem(SAVE_KEY, JSON.stringify(huge));
  expect(loadSavedState(storage, 0, "fallback").status).toBe("corrupt");
});
it("rejects forged move history and repetition counts", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  const forgedHistory = structuredClone(s);
  forgedHistory.game.hist[0].mv.to = forgedHistory.game.hist[0].mv.from;
  storage.setItem(SAVE_KEY, JSON.stringify(forgedHistory));
  expect(loadSavedState(storage, 2, "fallback").status).toBe("corrupt");
  const forgedKeys = structuredClone(s);
  forgedKeys.game.keys = { forged: 3 };
  storage.setItem(SAVE_KEY, JSON.stringify(forgedKeys));
  expect(loadSavedState(storage, 2, "fallback").status).toBe("corrupt");
});
it("rejects a rating receipt that does not match the saved rating", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  s.game.ratingApplied!.after += 100;
  storage.setItem(SAVE_KEY, JSON.stringify(s));
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
});
it("rejects a finished rated game with a missing receipt", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  s.game.ratingApplied = null;
  storage.setItem(SAVE_KEY, JSON.stringify(s));
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
});
it("preserves an undone game's unrated state without restoring its receipt", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  s = reduceSession(s, { type: "undo", now: 3 });
  expect(saveState(storage, s)).toBe(true);
  const loaded = loadSavedState(storage, 4, "fallback").session;
  expect(loaded.game.rated).toBe(false);
  expect(loaded.game.ratingApplied).toBeNull();
  expect(loaded.rating.games).toBe(0);
});
it("falls back to memory on unavailable storage", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  expect(loadSavedState(storage, 0, "one").status).toBe("unavailable");
  expect(saveState(storage, freshSession(0, "one"))).toBe(false);
  expect(loadSavedState(null, 0, "one").status).toBe("unavailable");
  expect(saveState(null, freshSession(0, "one"))).toBe(false);
});
it("imports a valid legacy rating only if a current save is absent", () => {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_KEY, JSON.stringify({ ...defaultRating(), rating: 1500, peak: 1500 }));
  const result = loadSavedState(storage, 0, "one");
  expect(result.session.rating.rating).toBe(1500);
  saveState(storage, freshSession(0, "new"));
  expect(loadSavedState(storage, 1, "fallback").session.rating.rating).toBe(1400);
});
it("does not use legacy data to conceal a corrupt current save", () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, "{broken");
  storage.setItem(LEGACY_KEY, JSON.stringify({ ...defaultRating(), rating: 1500, peak: 1500 }));
  const loaded = loadSavedState(storage, 0, "fallback");
  expect(loaded.status).toBe("corrupt");
  expect(loaded.session.rating.rating).toBe(1400);
});
it("charges elapsed closed time and settles timeout once on load", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, {
    type: "new",
    setup: { playerColor: "w", level: "club", time: "5+0" },
    now: 0,
    id: "two",
  });
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  saveState(storage, s);
  const loaded = loadSavedState(storage, 400000, "fallback");
  expect(loaded.session.game.over?.reason).toBe("Time out");
  expect(loaded.session.rating.games).toBe(1);
  saveState(storage, loaded.session);
  expect(loadSavedState(storage, 500000, "fallback").session.rating.games).toBe(1);
});

it("rejects corrupt coaching keys, annotation values and illegal evaluation moves", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  const invalid: unknown[] = [
    {
      ...s,
      game: {
        ...s.game,
        hist: s.game.hist.map((e) => ({
          ...e,
          motifs: [{ key: "invalid", detail: "bad", side: "w" }],
        })),
      },
    },
    { ...s, game: { ...s.game, evals: { 0: { score: 1000, best: { from: 20, to: 28 } } } } },
    { ...s, game: { ...s.game, evals: { 99: { score: 0, best: null } } } },
    { ...s, game: { ...s.game, hist: s.game.hist.map((e) => ({ ...e, ann: "invalid" })) } },
  ];
  for (const value of invalid) {
    storage.setItem(SAVE_KEY, JSON.stringify(value));
    expect(loadSavedState(storage, 2, "fallback").status).toBe("corrupt");
  }
});
it("requires bounded clocks and snapshots consistent with the time control", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, {
    type: "new",
    setup: { playerColor: "w", level: "club", time: "5+0" },
    now: 0,
    id: "two",
  });
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  for (const game of [
    { ...s.game, clocks: null },
    { ...s.game, clocks: { w: 1e100, b: 1e100 } },
    { ...s.game, hist: s.game.hist.map((e) => ({ ...e, clocksBefore: null })) },
    { ...s.game, clockAt: 1e100 },
  ]) {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...s, game }));
    expect(loadSavedState(storage, 2, "fallback").status).toBe("corrupt");
  }
});
it("rejects a rollback receipt whose peak and history do not produce the current rating", () => {
  const storage = new MemoryStorage();
  let s = freshSession(0, "one");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
  s = reduceSession(s, { type: "resign", now: 2 });
  s.game.ratingApplied!.before.peak = 9000;
  s.game.ratingApplied!.before.reached2400 = true;
  storage.setItem(SAVE_KEY, JSON.stringify(s));
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
});
