import { expect, test } from "vitest";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
import { freshSession } from "../../src/game/state";

test("v6 account authority preserves v5 ordered pending writes and advertises policy4", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const snapshot = freshSession(0, "pending-active"),
    terminal = freshSession(0, "pending-earlier");
  const oldKey = "chess-prodigy-account-v5:owner";
  const raw = JSON.stringify({
    baseVersion: 7,
    snapshot,
    pending: [
      { snapshot: terminal, terminal: true },
      { snapshot, terminal: false },
    ],
  });
  storage.setItem(oldKey, raw);
  const sent: string[] = [];
  const sync = new AccountSync("owner", storage, async (_url, init) => {
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Chess-Rating-Policy")).toBe("5");
    const body = JSON.parse(String(init?.body));
    expect(body.expectedVersion).toBe(7 + sent.length);
    expect(JSON.parse(storage.getItem(accountStorageKey("owner"))!).pending[0].snapshot).toEqual(
      body.snapshot,
    );
    sent.push(body.snapshot.game.id);
    return new Response(
      JSON.stringify({
        version: body.expectedVersion + 1,
        snapshot: body.snapshot,
        games: [],
        updatedAt: null,
      }),
    );
  });
  expect(accountStorageKey("owner")).toBe("chess-prodigy-account-v7:owner");
  expect(
    sync.initialize({
      version: 99,
      snapshot: freshSession(0, "server"),
      games: [],
      updatedAt: null,
    }).game.id,
  ).toBe("pending-active");
  await sync.flush();
  expect(sent).toEqual(["pending-earlier", "pending-active"]);
  expect(storage.getItem(oldKey)).toBe(raw);
  expect(sync.status()).toMatchObject({ state: "idle", pending: 0 });
});
