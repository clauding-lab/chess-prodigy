import { expect, it } from "vitest";
import { loadGuestHistory, saveGuestProgress, GUEST_HISTORY_KEY } from "../../src/storage/history";
import { SAVE_KEY, loadSavedState } from "../../src/storage/store";
import { parseSavedState } from "../../src/storage/schema";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
class Memory {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
function completed(id: string) {
  let s = freshSession(100, id);
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 101 });
  return reduceSession(s, { type: "resign", now: 102 });
}
it("backfills an existing terminal save, preserves other tab records, and reconciles undo", () => {
  const storage = new Memory(),
    a = completed("a"),
    b = completed("b");
  storage.setItem(SAVE_KEY, JSON.stringify(a));
  expect(saveGuestProgress(storage, loadSavedState(storage, 103, "fallback").session)).toBe(true);
  expect(saveGuestProgress(storage, b)).toBe(true);
  expect(saveGuestProgress(storage, a)).toBe(true);
  expect(
    loadGuestHistory(storage)
      .games.map((g) => g.id)
      .sort(),
  ).toEqual(["a", "b"]);
  expect(saveGuestProgress(storage, reduceSession(a, { type: "undo", now: 104 }))).toBe(true);
  expect(loadGuestHistory(storage).games.map((g) => g.id)).toEqual(["b"]);
  expect(JSON.parse(storage.getItem(SAVE_KEY)!)).not.toHaveProperty("games");
});
it("preserves corrupt or unknown archive bytes while retaining the active terminal for recovery", () => {
  for (const raw of ["broken", JSON.stringify({ version: 99, games: [] })]) {
    const storage = new Memory();
    storage.setItem(GUEST_HISTORY_KEY, raw);
    expect(saveGuestProgress(storage, completed("safe"))).toBe(false);
    expect(storage.getItem(GUEST_HISTORY_KEY)).toBe(raw);
    expect(loadGuestHistory(storage)).toMatchObject({ status: "corrupt", raw });
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).game.id).toBe("safe");
  }
});
it("does not report a newly written out-of-bounds archive as saved", () => {
  const storage = new Memory(),
    s = completed("x".repeat(256 * 1024 + 1));
  expect(saveGuestProgress(storage, s)).toBe(false);
  expect(storage.getItem(GUEST_HISTORY_KEY)).toBeNull();
  expect(storage.getItem(SAVE_KEY)).not.toBeNull();
});

it("preserves a legally played 501-ply terminal save without poisoning retained history", () => {
  const storage = new Memory();
  expect(saveGuestProgress(storage, completed("retained"))).toBe(true);
  const original = storage.getItem(GUEST_HISTORY_KEY);
  let s = freshSession(0, "long-legal-game"),
    random = 17;
  for (let ply = 0; ply < 501; ply++) {
    const priority = (m: ReturnType<typeof legalMoves>[number]) =>
      m.capture
        ? 3
        : s.game.st.halfmove > 35
          ? s.game.st.board[m.from]?.[1] === "p"
            ? 0
            : 1
          : s.game.st.board[m.from]?.[1] === "p"
            ? 2
            : 0;
    const candidates = legalMoves(s.game.st)
      .map((move) => {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        return { move, rank: random };
      })
      .sort((a, b) => priority(a.move) - priority(b.move) || a.rank - b.rank);
    let next: typeof s | undefined;
    for (const { move } of candidates) {
      const candidate = reduceSession(s, { type: "move", move, book: false, now: ply + 1 });
      if (!candidate.game.over) {
        next = candidate;
        break;
      }
    }
    if (!next) throw Error(`Cannot continue legal fixture at ${ply}`);
    s = next;
  }
  s = reduceSession(s, { type: "resign", now: 502 });
  expect(parseSavedState(s)).not.toBeNull();
  expect(saveGuestProgress(storage, s)).toBe(false);
  expect(storage.getItem(GUEST_HISTORY_KEY)).toBe(original);
  expect(JSON.parse(storage.getItem(SAVE_KEY)!).game.hist).toHaveLength(501);
  expect(loadGuestHistory(storage).status).toBe("ready");
});
it("reports archive quota failure and retries idempotently without losing the active result", () => {
  const storage = new Memory(),
    write = storage.setItem.bind(storage),
    s = completed("quota");
  storage.setItem = (key, value) => {
    if (key === GUEST_HISTORY_KEY) throw Error("quota");
    write(key, value);
  };
  expect(saveGuestProgress(storage, s)).toBe(false);
  expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  storage.setItem = write;
  expect(saveGuestProgress(storage, s)).toBe(true);
  expect(saveGuestProgress(storage, s)).toBe(true);
  expect(loadGuestHistory(storage).games).toHaveLength(1);
});

it("reconciles an interrupted undo from the still-authoritative terminal active save", () => {
  const storage = new Memory(),
    s = completed("interrupted");
  expect(saveGuestProgress(storage, s)).toBe(true);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === SAVE_KEY) throw Error("quota");
    write(key, value);
  };
  expect(saveGuestProgress(storage, reduceSession(s, { type: "undo", now: 104 }))).toBe(false);
  expect(loadGuestHistory(storage).games).toEqual([]);
  storage.setItem = write;
  const authoritative = loadSavedState(storage, 105, "unused").session;
  expect(saveGuestProgress(storage, authoritative)).toBe(true);
  expect(loadGuestHistory(storage).games).toHaveLength(1);
  expect(authoritative.rating).toEqual(s.rating);
});

it("copies even unchanged legacy history once so an old tab cannot replace the new archive", () => {
  const storage = new Memory(),
    old = JSON.stringify({ version: 1, games: [] });
  storage.setItem("chess-prodigy-guest-history-v1", old);
  expect(saveGuestProgress(storage, freshSession(0, "active"))).toBe(true);
  expect(storage.getItem("chess-prodigy-guest-history-v1")).toBe(old);
  storage.setItem("chess-prodigy-guest-history-v1", "stale-corruption");
  expect(loadGuestHistory(storage)).toMatchObject({ status: "ready", games: [] });
});
