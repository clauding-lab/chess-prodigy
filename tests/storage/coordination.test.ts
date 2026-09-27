import { expect, it } from "vitest";
import { acquireWriter, writerLockName } from "../../src/storage/coordination";

function locks() {
  const held = new Set<string>();
  return {
    held,
    request: async (
      name: string,
      options: { ifAvailable?: boolean },
      callback: (lock: object | null) => Promise<void>,
    ) => {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        await callback({});
      } finally {
        held.delete(name);
      }
    },
  };
}
it("holds a real exclusive lock until release and separates identities", async () => {
  const manager = locks();
  const options = { locks: manager as unknown as LockManager, channel: null };
  const guest = await acquireWriter("guest", () => {}, options);
  expect(guest?.active()).toBe(true);
  expect(await acquireWriter("guest", () => {}, options)).toBeNull();
  const account = await acquireWriter("account:one", () => {}, options);
  expect(account?.active()).toBe(true);
  guest!.release();
  expect(guest!.active()).toBe(false);
  await Promise.resolve();
  await Promise.resolve();
  expect(manager.held.has(writerLockName("guest"))).toBe(false);
  account!.release();
});
it("does not simulate a writable lock when browser locking is unavailable", async () => {
  expect(await acquireWriter("guest", () => {}, { locks: null, channel: null })).toBeNull();
});

it("a stale guest adapter cannot adopt an external revision and overwrite on retry", async () => {
  const { guestStorage } = await import("../../src/storage/play-storage");
  const { saveState, loadSavedState } = await import("../../src/storage/store");
  const { freshSession } = await import("../../src/game/state");
  localStorage.clear();
  const adapter = guestStorage(localStorage, {
    identity: "guest",
    active: () => true,
    release() {},
  });
  const initial = adapter.load(1000, "first");
  const external = freshSession(1000, "new-authority");
  expect(saveState(localStorage, external)).toBe(true);
  expect(adapter.save(initial.session)).toBe(false);
  expect(adapter.save(initial.session)).toBe(false);
  expect(loadSavedState(localStorage, 1000, "fallback").session.game.id).toBe("new-authority");
});

it("message-channel failures do not replace or prevent actual lock ownership", async () => {
  const manager = locks();
  const channel = class {
    constructor() {
      throw new DOMException("blocked", "SecurityError");
    }
  };
  const lease = await acquireWriter("guest", () => {}, {
    locks: manager as unknown as LockManager,
    channel: channel as unknown as typeof BroadcastChannel,
  });
  expect(lease?.active()).toBe(true);
  lease!.release();
});
