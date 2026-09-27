import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detachDevicePush,
  enableDevicePush,
  reconcileDevicePush,
} from "../../src/multiplayer/notifications";
const ownerKey = "chess-push-owner";
const unsubscribe = vi.fn<() => Promise<boolean>>();
beforeEach(() => {
  localStorage.clear();
  unsubscribe.mockReset().mockResolvedValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => Response.json({ user: { id: "b" } })),
  );
  vi.stubGlobal("navigator", {
    locks: {
      request: async (_name: string, _options: unknown, action: () => Promise<unknown>) => action(),
    },
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) },
      }),
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe("device push reconciliation before account mounting", () => {
  it("detaches expired-session account A before account B opens", async () => {
    localStorage.setItem(ownerKey, "a");
    await reconcileDevicePush("b");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ownerKey)).toBeNull();
  });
  it("detaches account A after reloading as a guest", async () => {
    localStorage.setItem(ownerKey, "a");
    vi.mocked(fetch).mockResolvedValue(Response.json(null));
    await reconcileDevicePush(null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ownerKey)).toBeNull();
  });
  it("retains subscriptions belonging to the authenticated account", async () => {
    localStorage.setItem(ownerKey, "a");
    vi.mocked(fetch).mockResolvedValue(Response.json({ user: { id: "a" } }));
    await reconcileDevicePush("a");
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem(ownerKey)).toBe("a");
  });
  it("blocks mutations when ownership storage is unreadable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    await expect(reconcileDevicePush("b")).rejects.toThrow();
    expect(unsubscribe).not.toHaveBeenCalled();
  });
  it("blocks account switching when unsubscribe fails and preserves owner information", async () => {
    localStorage.setItem(ownerKey, "a");
    unsubscribe.mockResolvedValue(false);
    await expect(reconcileDevicePush("b")).rejects.toThrow(
      "Could not disable the previous account",
    );
    expect(localStorage.getItem(ownerKey)).toBe("a");
    vi.mocked(fetch).mockResolvedValue(Response.json(null));
    unsubscribe.mockRejectedValue(new Error("offline"));
    await expect(reconcileDevicePush(null)).rejects.toThrow("offline");
  });
  it("does not block after successful cancellation if marker removal is unavailable", async () => {
    localStorage.setItem(ownerKey, "a");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    await expect(reconcileDevicePush("b")).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

it("does not let an old A tab unsubscribe B", async () => {
  localStorage.setItem(ownerKey, "b");
  await expect(detachDevicePush("a")).rejects.toThrow("another tab");
  expect(unsubscribe).not.toHaveBeenCalled();
});
it("requires browser cancellation even when server deletion succeeds", async () => {
  localStorage.setItem(ownerKey, "b");
  unsubscribe.mockResolvedValue(false);
  await expect(detachDevicePush("b")).rejects.toThrow("Could not disable device alerts");
  expect(localStorage.getItem(ownerKey)).toBe("b");
});
it("does not act on a permission result from before a device generation change", async () => {
  let permit!: (value: string) => void;
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    requestPermission: () =>
      new Promise((resolve) => {
        permit = resolve;
      }),
  });
  const enabling = enableDevicePush("a", "AAAA");
  localStorage.setItem("chess-push-generation", "new-b-generation");
  localStorage.setItem(ownerKey, "b");
  permit("granted");
  await expect(enabling).rejects.toThrow("another tab");
  expect(unsubscribe).not.toHaveBeenCalled();
});

it("serializes device mutations and rejects a queued operation from the previous generation", async () => {
  let tail = Promise.resolve();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, _options: unknown, action: () => Promise<void>) => {
        const next = tail.then(action);
        tail = next.catch(() => {});
        return next;
      },
    },
  });
  let release!: (value: boolean) => void;
  unsubscribe.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  localStorage.setItem(ownerKey, "a");
  const openingB = reconcileDevicePush("b");
  await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
  const staleA = detachDevicePush("a");
  const rejected = expect(staleA).rejects.toThrow("another tab");
  release(true);
  await openingB;
  await rejected;
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("allows a no-subscription browser without Web Locks to enter temporary play", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue({
    pushManager: { getSubscription: async () => null },
  } as unknown as ServiceWorkerRegistration);
  await expect(reconcileDevicePush(null)).resolves.toBeUndefined();
});
it("allows successful cancellation despite quota failure recording its generation", async () => {
  localStorage.setItem(ownerKey, "b");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  await expect(detachDevicePush("b")).resolves.toBeUndefined();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("ends A under the push lock when quota prevents invalidating its pending permission before temporary guest entry", async () => {
  let account: string | null = "a";
  let permit!: (value: string) => void;
  let subscribeCalls = 0;
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    requestPermission: () =>
      new Promise((resolve) => {
        permit = resolve;
      }),
  });
  vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue({
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => {
        subscribeCalls++;
        return { toJSON: () => ({}), unsubscribe };
      },
    },
  } as unknown as ServiceWorkerRegistration);
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === "/api/auth/sign-out") {
      account = null;
      return Response.json({});
    }
    return Response.json(account ? { user: { id: account } } : null);
  });
  const enabling = enableDevicePush("a", "AAAA");
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  await reconcileDevicePush(null, "a");
  quota.mockRestore();
  permit("granted");
  await expect(enabling).rejects.toThrow("another tab");
  expect(subscribeCalls).toBe(0);
  expect(account).toBeNull();
});
it("allows unreadable generation storage with no subscription after explicit authentication recovery", async () => {
  const { recoverSignOutIntent } = await import("../../src/account/api");
  vi.mocked(fetch).mockResolvedValue(Response.json(null));
  vi.mocked(navigator.serviceWorker.getRegistration).mockResolvedValue({
    pushManager: { getSubscription: async () => null },
  } as unknown as ServiceWorkerRegistration);
  const denied = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
  try {
    await recoverSignOutIntent();
    await expect(reconcileDevicePush(null)).resolves.toBeUndefined();
  } finally {
    denied.mockRestore();
  }
});
