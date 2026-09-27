import { encodeCompactSession } from "../../src/storage/compact";
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
  const offline = new AccountSync("user", storage);
  expect(offline.initialize(envelope(), false).game.id).toBe("authoritative");
  const raw = storage.getItem(accountStorageKey("user"));
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
      return new Response(
        JSON.stringify({ current: { ...envelope(1), snapshot: encodeCompactSession(accepted) } }),
        {
          status: 409,
        },
      );
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

it.each([400, 413])(
  "preserves and exports a permanent %s rejection without automatic retries",
  async (status) => {
    const storage = new MemoryStorage();
    const request = vi.fn(async () => new Response(null, { status }));
    const sync = new AccountSync("user", storage, request);
    sync.initialize(envelope(7));
    sync.save(freshSession(1, "rejected"), { terminal: true });
    await sync.flush();
    sync.save(freshSession(2, "later"), { terminal: true });
    await sync.flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sync.status()).toMatchObject({ state: "rejected", pending: 2 });
    const reloaded = new AccountSync("user", storage, request);
    reloaded.initialize(envelope(7));
    await reloaded.flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(reloaded.status()).toMatchObject({ state: "rejected", pending: 2 });
    expect(
      JSON.parse(reloaded.exportRecovery()).pending.map(
        (item: { snapshot: { game: { id: string } } }) => item.snapshot.game.id,
      ),
    ).toEqual(["rejected", "later"]);
  },
);

it("never describes a rejected outbox as durable when later local writes fail", async () => {
  const storage = new MemoryStorage();
  const request = vi.fn(async () => new Response(null, { status: 413 }));
  const sync = new AccountSync("user", storage, request);
  sync.initialize(envelope());
  sync.save(freshSession(1, "rejected"));
  await sync.flush();
  const write = storage.setItem.bind(storage);
  storage.setItem = () => {
    throw Error("quota");
  };
  expect(sync.save(freshSession(2, "memory-only"), { terminal: true })).toBe(false);
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "storage-error", pending: 2 });
  expect(JSON.parse(sync.exportRecovery()).pending).toHaveLength(2);
  const durable = new AccountSync("user", storage, request);
  expect(durable.initialize(envelope()).game.id).toBe("rejected");
  storage.setItem = write;
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "rejected", pending: 2 });
  expect(new AccountSync("user", storage, request).initialize(envelope()).game.id).toBe(
    "memory-only",
  );
  expect(request).toHaveBeenCalledTimes(1);
});

it("retains a failed rejection-marker write in memory and retries persistence before reporting saved recovery", async () => {
  const storage = new MemoryStorage();
  const write = storage.setItem.bind(storage);
  const request = vi.fn(async () => {
    storage.setItem = () => {
      throw Error("quota");
    };
    return new Response(null, { status: 400 });
  });
  const sync = new AccountSync("user", storage, request);
  sync.initialize(envelope());
  sync.save(freshSession(1, "rejected"));
  await sync.flush();
  expect(sync.status().state).toBe("storage-error");
  expect(JSON.parse(sync.exportRecovery()).pending[0].rejected).toBe(400);
  await sync.flush();
  expect(sync.status().state).toBe("storage-error");
  storage.setItem = write;
  await sync.flush();
  expect(sync.status().state).toBe("rejected");
  expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).pending[0].rejected).toBe(400);
  expect(request).toHaveBeenCalledTimes(1);
});

it("does not let a disposed rejected sync overwrite its replacement's cache", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync("user", storage, async () => new Response(null, { status: 413 }));
  sync.initialize(envelope());
  sync.save(freshSession(1, "rejected"));
  await sync.flush();
  sync.dispose();
  const replacement = new AccountSync("user", storage);
  replacement.initialize(envelope());
  replacement.save(freshSession(2, "replacement"));
  const expected = storage.getItem(accountStorageKey("user"));
  await sync.flush();
  expect(storage.getItem(accountStorageKey("user"))).toBe(expected);
});

it.each([200, 409])(
  "preserves an already attempted legacy wire across reload and exact %s acknowledgement",
  async (status) => {
    const storage = new MemoryStorage();
    const raw = JSON.parse(JSON.stringify(freshSession(1, "legacy-attempt")));
    raw.version = 1;
    delete raw.game.opponent;
    delete raw.game.unratedReason;
    delete raw.game.takebackUsed;
    raw.game.evals = { 0: { score: 8888, best: null } };
    storage.setItem(
      accountStorageKey("user"),
      JSON.stringify({
        baseVersion: 7,
        snapshot: raw,
        pending: [{ snapshot: raw, terminal: false, attempted: true }],
      }),
    );
    const request = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.snapshot).toEqual(raw);
      const accepted = { ...envelope(8), snapshot: raw };
      return new Response(JSON.stringify(status === 409 ? { current: accepted } : accepted), {
        status,
      });
    });
    const sync = new AccountSync("user", storage, request);
    expect(sync.initialize(envelope(8)).game.evals).toEqual({});
    expect(JSON.parse(storage.getItem(accountStorageKey("user"))!).pending[0].snapshot).toEqual(
      raw,
    );
    expect(JSON.parse(sync.exportRecovery()).pending[0].snapshot).toEqual(raw);
    await sync.flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(sync.status()).toMatchObject({ state: "idle", pending: 0 });
  },
);

it("does not coalesce a restored old outbox that predates attempted-write markers", () => {
  const storage = new MemoryStorage();
  const pending = freshSession(1, "same-game");
  storage.setItem(
    accountStorageKey("user"),
    JSON.stringify({
      baseVersion: 7,
      snapshot: pending,
      pending: [{ snapshot: pending, terminal: false }],
    }),
  );
  const sync = new AccountSync("user", storage);
  sync.initialize(envelope(7));
  sync.save(freshSession(2, "same-game"));
  const retained = JSON.parse(sync.exportRecovery()).pending;
  expect(retained).toHaveLength(2);
  expect(retained[0].snapshot).toEqual(pending);
});

it("explicitly converts a permanently rejected legacy pending save while retaining its exact recovery copy", async () => {
  const storage = new MemoryStorage();
  const old = freshSession(1, "oversized-legacy");
  old.game.evals[0] = { score: 999, best: null };
  const raw = JSON.stringify({
    baseVersion: 7,
    snapshot: old,
    pending: [{ snapshot: old, terminal: true, attempted: true, rejected: 413 }],
  });
  storage.setItem(accountStorageKey("user"), raw);
  const request = vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body.snapshot.version).toBe(3);
    expect(body.expectedVersion).toBe(7);
    return new Response(JSON.stringify({ ...envelope(8), snapshot: body.snapshot }));
  });
  const sync = new AccountSync("user", storage, request);
  sync.initialize(envelope(7));
  sync.save(freshSession(2, "later"), { terminal: true });
  await sync.flush();
  expect(request).not.toHaveBeenCalled();
  expect(sync.status().canCompactRetry).toBe(true);
  expect(sync.retryCompactRejected()).toBe(true);
  const recovery = JSON.parse(sync.exportRecovery());
  expect(recovery.pending[0].originalRejected).toEqual(old);
  expect(recovery.pending[0].snapshot.version).toBe(3);
  expect(recovery.pending[1].snapshot.game.id).toBe("later");
  // A successful acknowledgement can be consumed without discarding later work.
  sync.dispose();
  const reloaded = new AccountSync("user", storage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ ...envelope(body.expectedVersion + 1), snapshot: body.snapshot }),
    );
  });
  reloaded.initialize(envelope(7));
  expect(JSON.parse(reloaded.exportRecovery()).pending[0].originalRejected).toEqual(old);
  await reloaded.flush();
  expect(reloaded.status()).toMatchObject({ state: "idle", pending: 0 });
});
it("never rewrites an ambiguously attempted or already compact rejected wire", async () => {
  const storage = new MemoryStorage();
  const sync = new AccountSync("user", storage, async () => new Response(null, { status: 413 }));
  sync.initialize(envelope());
  sync.save(freshSession(1, "compact"));
  expect(sync.retryCompactRejected()).toBe(false);
  await sync.flush();
  expect(sync.status().canCompactRetry).toBe(false);
  expect(sync.retryCompactRejected()).toBe(false);
});

it("retains original rejected recovery when a converted nonterminal game changes before retry", () => {
  const storage = new MemoryStorage();
  const old = freshSession(1, "same-game");
  storage.setItem(
    accountStorageKey("user"),
    JSON.stringify({
      baseVersion: 7,
      snapshot: old,
      pending: [{ snapshot: old, terminal: false, attempted: true, rejected: 413 }],
    }),
  );
  const sync = new AccountSync("user", storage);
  sync.initialize(envelope(7));
  expect(sync.retryCompactRejected()).toBe(true);
  expect(sync.save(freshSession(2, "same-game"))).toBe(true);
  const recovery = JSON.parse(sync.exportRecovery());
  expect(recovery.pending).toHaveLength(2);
  expect(recovery.pending[0].originalRejected).toEqual(old);
  expect(recovery.pending[1].snapshot.game.clockAt).toBe(2);
  sync.dispose();
  const reloaded = new AccountSync("user", storage);
  reloaded.initialize(envelope(7));
  expect(JSON.parse(reloaded.exportRecovery()).pending[0].originalRejected).toEqual(old);
});
