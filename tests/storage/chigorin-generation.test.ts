import { expect, test } from "vitest";
import { freshSession } from "../../src/game/state";
import { loadSavedState, saveState, SAVE_KEY } from "../../src/storage/store";
import { loadGuestHistory, saveGuestProgress, GUEST_HISTORY_KEY } from "../../src/storage/history";

test("new authority preserves v5 originals and blocks fallback from corrupt v6", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const original = JSON.stringify(freshSession(0, "old-v5"));
  storage.setItem("chess-prodigy-state-v5", original);
  const loaded = loadSavedState(storage, 1, "fallback");
  expect(loaded.session.game.id).toBe("old-v5");
  expect(saveState(storage, loaded.session)).toBe(true);
  expect(SAVE_KEY).toBe("chess-prodigy-state-v6");
  expect(storage.getItem("chess-prodigy-state-v5")).toBe(original);
  storage.setItem("chess-prodigy-state-v5", JSON.stringify(freshSession(0, "stale-client")));
  expect(loadSavedState(storage, 2, "fallback").session.game.id).toBe("old-v5");
  storage.setItem(SAVE_KEY, "broken-new-authority");
  expect(loadSavedState(storage, 3, "fallback").status).toBe("corrupt");
});

test("history advances to v5 without rewriting v4 recovery and corrupt authority wins", () => {
  const values = new Map([["chess-prodigy-guest-history-v4", '{"version":1,"games":[]}']]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  expect(saveGuestProgress(storage, freshSession(0, "game"))).toBe(true);
  expect(GUEST_HISTORY_KEY).toBe("chess-prodigy-guest-history-v5");
  expect(storage.getItem("chess-prodigy-guest-history-v4")).toBe('{"version":1,"games":[]}');
  storage.setItem(GUEST_HISTORY_KEY, "broken");
  expect(loadGuestHistory(storage)).toMatchObject({ status: "corrupt", raw: "broken" });
});
