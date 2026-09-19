import { expect, test } from "vitest";
import { freshSession } from "../../src/game/state";
import { loadSavedState, saveState, SAVE_KEY } from "../../src/storage/store";
import { loadGuestHistory, saveGuestProgress, GUEST_HISTORY_KEY } from "../../src/storage/history";
for (let version = 1; version <= 6; version++)
  test(`v${version} guest recovery survives v7 write and current corruption wins`, () => {
    const old = `chess-prodigy-state-v${version}`,
      raw = JSON.stringify(freshSession(0, old));
    const values = new Map([[old, raw]]),
      storage = {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => {
          values.set(k, v);
        },
      };
    const result = loadSavedState(storage, 1, "fallback");
    expect(result.session.game.id).toBe(old);
    expect(saveState(storage, result.session)).toBe(true);
    expect(SAVE_KEY).toBe("chess-prodigy-state-v7");
    expect(values.get(old)).toBe(raw);
    values.set(SAVE_KEY, "broken");
    expect(loadSavedState(storage, 2, "fallback").status).toBe("corrupt");
    expect(values.get(SAVE_KEY)).toBe("broken");
  });
for (let version = 1; version <= 5; version++)
  test(`history v${version} recovers into v6 without deleting old bytes`, () => {
    const old = `chess-prodigy-guest-history-v${version}`,
      raw = JSON.stringify({ version: 1, games: [] });
    const values = new Map([[old, raw]]),
      storage = {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => {
          values.set(k, v);
        },
      };
    expect(saveGuestProgress(storage, freshSession(0, "x"))).toBe(true);
    expect(GUEST_HISTORY_KEY).toBe("chess-prodigy-guest-history-v6");
    expect(values.get(old)).toBe(raw);
    values.set(GUEST_HISTORY_KEY, "bad");
    expect(loadGuestHistory(storage)).toMatchObject({ status: "corrupt", raw: "bad" });
    expect(saveGuestProgress(storage, freshSession(0, "y"))).toBe(false);
    expect(values.get(GUEST_HISTORY_KEY)).toBe("bad");
  });
