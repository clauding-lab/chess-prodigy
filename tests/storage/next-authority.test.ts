import { expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import { encodeCompactSession } from "../../src/storage/compact";
import { SAVE_KEY, loadSavedState, saveState } from "../../src/storage/store";
import { GUEST_HISTORY_KEY, loadGuestHistory, saveGuestProgress } from "../../src/storage/history";
import { playLine, FOOLS_MATE } from "../game/play-line";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
class Memory {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
it("migrates the latest guest authority without modifying recovery bytes", () => {
  const storage = new Memory(),
    raw = JSON.stringify(encodeCompactSession(freshSession(0, "previous")));
  storage.setItem("chess-prodigy-state-v8", raw);
  expect(SAVE_KEY).toBe("chess-prodigy-state-v9");
  const loaded = loadSavedState(storage, 0, "fallback");
  expect(loaded.session.game.id).toBe("previous");
  const next = reduceSession(loaded.session, {
    type: "new",
    id: "experiment",
    now: 1,
    setup: {
      playerColor: "w",
      level: "club",
      time: "none",
      opponent: experimentalRosterConfig("tal", 3),
    },
  });
  expect(saveState(storage, next)).toBe(true);
  expect(loadSavedState(storage, 1, "fallback").session.game.opponent.version).toBe(2);
  expect(storage.getItem("chess-prodigy-state-v8")).toBe(raw);
  expect(GUEST_HISTORY_KEY).toBe("chess-prodigy-guest-history-v8");
  const archive = new Memory();
  const completed = playLine(freshSession(100, "retained-terminal"), FOOLS_MATE, 102);
  expect(saveGuestProgress(archive, completed)).toBe(true);
  const expected = loadGuestHistory(archive).games;
  expect(expected).toHaveLength(1);
  const history = archive.getItem(GUEST_HISTORY_KEY)!;
  storage.setItem("chess-prodigy-guest-history-v7", history);
  expect(loadGuestHistory(storage)).toMatchObject({ status: "ready", games: expected });
  expect(storage.getItem("chess-prodigy-guest-history-v7")).toBe(history);
});
it("preserves a previous compact account outbox and sends its exact pending envelope", async () => {
  const storage = new Memory(),
    snapshot = encodeCompactSession(freshSession(0, "pending"));
  const raw = JSON.stringify({
    baseVersion: 4,
    snapshot,
    pending: [{ snapshot, terminal: false, attempted: true }],
  });
  storage.setItem("chess-prodigy-account-v8:user", raw);
  expect(accountStorageKey("user")).toBe("chess-prodigy-account-v9:user");
  const sync = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ expectedVersion: 4, snapshot });
    expect(new Headers(init?.headers).get("X-Chess-Rating-Policy")).toBe("7");
    return new Response(JSON.stringify({ version: 5, snapshot, games: [], updatedAt: null }));
  });
  try {
    expect(
      sync.initialize({ version: 4, snapshot: null, games: [], updatedAt: null }).game.id,
    ).toBe("pending");
    await sync.flush();
    expect(sync.status().pending).toBe(0);
    expect(storage.getItem("chess-prodigy-account-v8:user")).toBe(raw);
  } finally {
    sync.dispose();
  }
});
