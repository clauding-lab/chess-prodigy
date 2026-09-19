import { expect, test } from "vitest";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
import { freshSession } from "../../src/game/state";

for (let generation = 1; generation <= 6; generation++)
  test(`v7 account preserves v${generation} pending order and advertises policy5`, async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const snapshot = freshSession(0, "pending-active"),
      terminal = freshSession(0, "pending-earlier");
    const oldKey = `chess-prodigy-account-v${generation}:owner`;
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

test("corrupt v7 authority blocks recovery overwrite and pending transmission", async () => {
  const snapshot = freshSession(0, "old");
  const values = new Map([
    [accountStorageKey("owner"), "broken"],
    [
      "chess-prodigy-account-v6:owner",
      JSON.stringify({ baseVersion: 1, snapshot, pending: [{ snapshot, terminal: false }] }),
    ],
  ]);
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  let sends = 0;
  const sync = new AccountSync("owner", storage, async () => {
    sends++;
    throw Error("no request expected");
  });
  sync.initialize({ version: 2, snapshot: freshSession(1, "remote"), games: [], updatedAt: null });
  await sync.flush();
  expect(sync.status().state).toBe("storage-error");
  expect(sends).toBe(0);
  expect(values.get(accountStorageKey("owner"))).toBe("broken");
});
test("v7 durability failure preserves v6 outbox and does not send before local protection", async () => {
  const snapshot = freshSession(0, "pending"),
    raw = JSON.stringify({ baseVersion: 2, snapshot, pending: [{ snapshot, terminal: false }] });
  let sends = 0;
  const storage = {
    getItem: (k: string) => (k === "chess-prodigy-account-v6:owner" ? raw : null),
    setItem: () => {
      throw Error("quota");
    },
  };
  const sync = new AccountSync("owner", storage, async () => {
    sends++;
    throw Error("no request expected");
  });
  sync.initialize({ version: 3, snapshot: freshSession(1, "remote"), games: [], updatedAt: null });
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "storage-error", pending: 1 });
  expect(sends).toBe(0);
  expect(storage.getItem("chess-prodigy-account-v6:owner")).toBe(raw);
});
