import { expect, it, vi } from "vitest";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
import { freshSession } from "../../src/game/state";

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
const envelope = (version = 0, id = "initial") => ({
  version,
  snapshot: freshSession(0, id),
  games: [],
  updatedAt: null,
});

it("does not create writable account authority from a failed download without a cache", async () => {
  const storage = new MemoryStorage(),
    request = vi.fn();
  const sync = new AccountSync("user", storage, request);
  expect(() => sync.initialize(envelope(), false)).toThrow(/download|unavailable/i);
  expect(sync.save(freshSession(1, "invented"))).toBe(false);
  await sync.flush();
  expect(request).not.toHaveBeenCalled();
  expect(storage.getItem(accountStorageKey("user"))).toBeNull();
});

it("uses an authentic cached copy offline but refuses a regressed acknowledged server version", () => {
  const storage = new MemoryStorage();
  new AccountSync("user", storage).initialize(envelope(7, "authoritative"));
  const raw = storage.getItem(accountStorageKey("user"));
  const offline = new AccountSync("user", storage);
  expect(offline.initialize(envelope(), false).game.id).toBe("authoritative");
  const regressed = new AccountSync("user", storage);
  expect(() => regressed.initialize(envelope(6, "older"))).toThrow(/version|older/i);
  expect(regressed.save(freshSession(1, "replacement"))).toBe(false);
  expect(storage.getItem(accountStorageKey("user"))).toBe(raw);
});

it("recognizes a lost acknowledgement after reload and preserves later pending games", async () => {
  const storage = new MemoryStorage();
  const accepted = freshSession(1, "first");
  const first = new AccountSync("user", storage, async () => {
    throw new Error("lost response");
  });
  first.initialize(envelope());
  first.save(accepted, { terminal: true });
  await first.flush();
  first.save(freshSession(2, "second"), { terminal: true });
  const sent: string[] = [];
  const reloaded = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    sent.push(body.snapshot.game.id);
    if (body.expectedVersion === 0)
      return new Response(JSON.stringify({ current: { ...envelope(1), snapshot: accepted } }), {
        status: 409,
      });
    return new Response(JSON.stringify({ ...envelope(2), snapshot: body.snapshot }));
  });
  reloaded.initialize({ ...envelope(1), snapshot: accepted });
  await reloaded.flush();
  expect(reloaded.status()).toMatchObject({ state: "idle", pending: 0 });
  expect(sent).toEqual(["first", "second"]);
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).snapshot.game.id).toBe("second");
});

it("does not coalesce an attempted save whose acknowledgement may have been lost", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync("user", storage, async () => {
    throw new Error("lost response");
  });
  sync.initialize(envelope());
  sync.save(freshSession(1, "same"));
  await sync.flush();
  sync.save(freshSession(2, "same"));
  const pending = JSON.parse(storage.getItem(accountStorageKey("user"))!).pending;
  expect(pending).toHaveLength(2);
  expect(pending[0].snapshot.game.clockAt).toBe(1);
  expect(pending[1].snapshot.game.clockAt).toBe(2);
});

it("preserves an upgrade-required outbox and its exact expected version", async () => {
  const storage = new MemoryStorage();
  const bodies: string[] = [];
  const sync = new AccountSync("user", storage, async (_url, init) => {
    bodies.push(String(init?.body));
    return new Response(null, { status: 426 });
  });
  sync.initialize(envelope(7));
  sync.save(freshSession(1, "pending"), { terminal: true });
  await sync.flush();
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "upgrade-required", pending: 1 });
  expect(bodies[0]).toBe(bodies[1]);
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).baseVersion).toBe(7);
});

it("preserves pending authority when a conflict response regresses the server version", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync(
    "user",
    storage,
    async () => new Response(JSON.stringify({ current: envelope(6) }), { status: 409 }),
  );
  sync.initialize(envelope(7));
  sync.save(freshSession(1, "pending"));
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "error", pending: 1, conflict: null });
  const cached = JSON.parse(storage.getItem(accountStorageKey("user"))!);
  expect(cached.baseVersion).toBe(7);
  expect(cached.pending[0].snapshot.game.id).toBe("pending");
});

it("does not acknowledge a different raw snapshot even when normalization removes the difference", async () => {
  const storage = new MemoryStorage();
  const pending = freshSession(1, "pending");
  const remote = structuredClone(pending);
  // Unknown derived evaluations are normalized away at the client boundary.
  Object.assign(remote.game.evals, { 0: { score: 999, best: null } });
  const sync = new AccountSync(
    "user",
    storage,
    async () =>
      new Response(JSON.stringify({ current: { ...envelope(1), snapshot: remote } }), {
        status: 409,
      }),
  );
  sync.initialize(envelope());
  sync.save(pending);
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "conflict", pending: 1 });
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).baseVersion).toBe(0);
});
