import { afterEach, expect, it, vi } from "vitest";
import { freshSession } from "../../src/game/state";
import { AccountSync, accountStorageKey } from "../../src/account/sync";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const empty = { version: 0, snapshot: null, games: [], updatedAt: null } as const;
const initial = () => ({ ...empty, snapshot: freshSession(0, "initial") });

afterEach(() => vi.useRealTimers());

it("keeps the original cloud version and pending snapshot across an offline reload", async () => {
  const storage = new MemoryStorage();
  const first = new AccountSync("user/one", storage, async () => {
    throw new TypeError("offline");
  });
  const session = freshSession(100, "offline-game");
  first.initialize({ ...empty, version: 7, snapshot: freshSession(90, "cloud-game") });
  first.save(session);
  await first.flush();

  const reloaded = new AccountSync("user/one", storage, async () => {
    throw new TypeError("still offline");
  });
  const loaded = reloaded.initialize({
    ...empty,
    version: 9,
    snapshot: freshSession(120, "other"),
  });

  expect(loaded.game.id).toBe("offline-game");
  expect(JSON.parse(storage.getItem(accountStorageKey("user/one"))!)).toMatchObject({
    baseVersion: 7,
    pending: [{ snapshot: { game: { id: "offline-game" } } }],
  });
});

it("serializes writes and acknowledges only the snapshot that was sent", async () => {
  const storage = new MemoryStorage();
  const requests: Array<{ expectedVersion: number; snapshot: ReturnType<typeof freshSession> }> =
    [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sync = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    if (requests.length === 1) await blocked;
    return new Response(
      JSON.stringify({ ...empty, version: body.expectedVersion + 1, snapshot: body.snapshot }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  sync.initialize(initial());
  sync.save(freshSession(1, "first"), { terminal: true });
  const flushing = sync.flush();
  sync.save(freshSession(2, "second"), { terminal: true });
  release();
  await flushing;

  expect(requests.map((request) => [request.expectedVersion, request.snapshot.game.id])).toEqual([
    [0, "first"],
    [1, "second"],
  ]);
  expect(sync.status().pending).toBe(0);
});

it("coalesces ordinary changes but never drops a terminal snapshot", () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync("user", storage, fetch);
  sync.initialize(initial());
  sync.save(freshSession(1, "same"));
  sync.save(freshSession(2, "same"));
  sync.save(freshSession(3, "abandoned"), { terminal: true });
  sync.save(freshSession(4, "new"));
  sync.save(freshSession(5, "new"));

  expect(sync.status().pending).toBe(3);
  const saved = JSON.parse(storage.getItem(accountStorageKey("user"))!);
  expect(
    saved.pending.map((item: { snapshot: { game: { id: string } } }) => item.snapshot.game.id),
  ).toEqual(["same", "abandoned", "new"]);
});

it("requires an explicit choice after a conflict", async () => {
  const storage = new MemoryStorage();
  const cloud = { ...empty, version: 4, snapshot: freshSession(4, "cloud") };
  const requests: number[] = [];
  const sync = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body.expectedVersion);
    if (requests.length === 1)
      return new Response(JSON.stringify({ error: "conflict", current: cloud }), { status: 409 });
    return new Response(JSON.stringify({ ...cloud, version: 5, snapshot: body.snapshot }), {
      status: 200,
    });
  });
  sync.initialize(initial());
  sync.save(freshSession(1, "device"));
  await sync.flush();
  expect(sync.status().state).toBe("conflict");
  expect(sync.useCloud()!.game.id).toBe("cloud");
  expect(sync.status().pending).toBe(0);

  sync.save(freshSession(2, "device-two"));
  await sync.flush();
  sync.keepDevice();
  await sync.flush();
  expect(requests.at(-1)).toBe(4);
});

it("rebases every queued terminal snapshot when the player keeps the device copy", async () => {
  const storage = new MemoryStorage();
  const cloud = { ...empty, version: 8, snapshot: freshSession(8, "cloud") };
  const sent: string[] = [];
  let conflict = true;
  const sync = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body.snapshot.game.id);
    if (conflict) {
      conflict = false;
      return new Response(JSON.stringify({ error: "conflict", current: cloud }), { status: 409 });
    }
    return new Response(
      JSON.stringify({ ...cloud, version: body.expectedVersion + 1, snapshot: body.snapshot }),
      { status: 200 },
    );
  });
  sync.initialize(initial());
  sync.save(freshSession(1, "finished-one"), { terminal: true });
  sync.save(freshSession(2, "finished-two"), { terminal: true });
  await sync.flush();
  sync.keepDevice();
  await sync.flush();
  expect(sent).toEqual(["finished-one", "finished-one", "finished-two"]);
});

it("reports signed-out writes without discarding them", async () => {
  const sync = new AccountSync(
    "user",
    new MemoryStorage(),
    async () => new Response(null, { status: 401 }),
  );
  sync.initialize(initial());
  sync.save(freshSession(1, "private"));
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "signed-out", pending: 1 });
});

it("binds every write to the account identity used to create the sync", async () => {
  let header: string | null = null;
  const sync = new AccountSync("account-a", new MemoryStorage(), async (_url, init) => {
    header = new Headers(init?.headers).get("X-Chess-Account");
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ...initial(), version: 1, snapshot: body.snapshot }), {
      status: 200,
    });
  });
  sync.initialize(initial());
  sync.save(freshSession(2, "bound"));
  await sync.flush();
  expect(header).toBe("account-a");
});

it("keeps the outbox and version when a success response is truncated", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync(
    "user",
    storage,
    async () => new Response('{"version":1', { status: 200 }),
  );
  sync.initialize(initial());
  sync.save(freshSession(2, "unsafely-acknowledged"));
  await expect(sync.flush()).resolves.toBeUndefined();
  expect(sync.status()).toMatchObject({ state: "error", pending: 1 });
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).baseVersion).toBe(0);
});

it("rejects an invalid success envelope without acknowledging its snapshot", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync(
    "user",
    storage,
    async () => new Response(JSON.stringify({ version: 99, snapshot: null, games: [] })),
  );
  sync.initialize(initial());
  sync.save(freshSession(2, "pending"));
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "error", pending: 1 });
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).baseVersion).toBe(0);
});

it("times out a stalled success body while preserving the pending change", async () => {
  vi.useFakeTimers();
  const sync = new AccountSync("user", new MemoryStorage(), async () => {
    const response = new Response();
    response.json = () => new Promise<never>(() => {});
    return response;
  });
  sync.initialize(initial());
  sync.save(freshSession(2, "stalled"));
  const flushing = sync.flush();
  await vi.advanceTimersByTimeAsync(8001);
  await flushing;
  expect(sync.status()).toMatchObject({ state: "error", pending: 1 });
});

it("does not overwrite a corrupt account save or report it as saved", () => {
  const storage = new MemoryStorage();
  storage.setItem(accountStorageKey("user"), "damaged");
  const sync = new AccountSync("user", storage, fetch);
  sync.initialize(initial());
  expect(sync.save(freshSession(2, "current"))).toBe(false);
  expect(storage.getItem(accountStorageKey("user"))).toBe("damaged");
  expect(sync.status().state).toBe("storage-error");
});

it("aborts an outstanding account write when the account is replaced", async () => {
  let signal: AbortSignal | null = null;
  const sync = new AccountSync("old-user", new MemoryStorage(), async (_url, init) => {
    signal = init?.signal as AbortSignal;
    return new Promise<Response>((_resolve, reject) =>
      signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
    );
  });
  sync.initialize(initial());
  sync.save(freshSession(2, "old-account-game"));
  const flushing = sync.flush();
  await Promise.resolve();
  sync.dispose();
  await flushing;
  expect(signal!.aborted).toBe(true);
});
