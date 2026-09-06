import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileDevicePush } from "../../src/multiplayer/notifications";
const ownerKey = "chess-push-owner";
const unsubscribe = vi.fn<() => Promise<boolean>>();
beforeEach(() => {
  localStorage.clear();
  unsubscribe.mockReset().mockResolvedValue(true);
  vi.stubGlobal("navigator", {
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
    await reconcileDevicePush(null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ownerKey)).toBeNull();
  });
  it("retains subscriptions belonging to the authenticated account", async () => {
    localStorage.setItem(ownerKey, "a");
    await reconcileDevicePush("a");
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem(ownerKey)).toBe("a");
  });
  it("cancels subscriptions with missing or unreadable owner storage", async () => {
    await reconcileDevicePush("a");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    await reconcileDevicePush("a");
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
  it("blocks account switching when unsubscribe fails and preserves owner information", async () => {
    localStorage.setItem(ownerKey, "a");
    unsubscribe.mockResolvedValue(false);
    await expect(reconcileDevicePush("b")).rejects.toThrow(
      "Could not disable the previous account",
    );
    expect(localStorage.getItem(ownerKey)).toBe("a");
    unsubscribe.mockRejectedValue(new Error("offline"));
    await expect(reconcileDevicePush(null)).rejects.toThrow(
      "Could not disable the previous account",
    );
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
