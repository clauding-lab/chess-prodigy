import { afterEach, expect, it, vi } from "vitest";
import { json } from "../../src/account/api";
import { subscribeSessionExpiry } from "../../src/account/session-expiry";

afterEach(() => vi.unstubAllGlobals());
it("broadcasts authenticated 401 identity but not a rejected login or another status", async () => {
  const listener = vi.fn();
  const stop = subscribeSessionExpiry(listener);
  try {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(
      json("/api/multiplayer/abc/chat", { headers: { "x-chess-account": "A" } }),
    ).rejects.toThrow();
    expect(listener).toHaveBeenCalledExactlyOnceWith("A");
    await expect(json("/api/auth/sign-in/email")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(
      json("/api/records", { headers: new Headers({ "X-Chess-Account": "B" }) }),
    ).rejects.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});

it("accepts an already expired sign-out as session ended", async () => {
  const { signOut } = await import("../../src/account/api");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
  await expect(signOut("A")).resolves.toBeUndefined();
});

it("does not sign out B to fulfill an offline sign-out intent from A", async () => {
  const { retainSignOutIntent, getAccountSession } = await import("../../src/account/api");
  retainSignOutIntent("A");
  const request = vi.fn().mockResolvedValue(Response.json({ user: { id: "B", name: "B" } }));
  vi.stubGlobal("fetch", request);
  await expect(getAccountSession()).resolves.toMatchObject({ id: "B" });
  expect(request).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("chess-account-sign-out-intent")).toBeNull();
});
it("completes a retained logout before returning the same authenticated account", async () => {
  const { retainSignOutIntent, getAccountSession } = await import("../../src/account/api");
  retainSignOutIntent("A");
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ user: { id: "A" } }))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal("fetch", request);
  await expect(getAccountSession()).resolves.toBeNull();
  expect(request).toHaveBeenLastCalledWith(
    "/api/auth/sign-out",
    expect.objectContaining({ headers: { "X-Chess-Account": "A" } }),
  );
});

it.each(["{", "null", "{}", '{"userId":"A"}', '"text"', "x".repeat(5000)])(
  "reports a recoverable invalid logout marker: %s",
  async (raw) => {
    const { getAccountSession } = await import("../../src/account/api");
    localStorage.setItem("chess-account-sign-out-intent", raw);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ user: { id: "A" } })));
    await expect(getAccountSession()).rejects.toThrow("Sign-out recovery is needed");
    expect(localStorage.getItem("chess-account-sign-out-intent")).toBe(raw);
    localStorage.clear();
  },
);
it("reports blocked logout-marker storage as recoverable", async () => {
  const { getAccountSession } = await import("../../src/account/api");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ user: { id: "A" } })));
  const blocked = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
  try {
    await expect(getAccountSession()).rejects.toThrow("Sign-out recovery is needed");
  } finally {
    blocked.mockRestore();
  }
});

it("recovers denied storage by explicit server logout before allowing fresh authentication", async () => {
  const { getAccountSession, recoverSignOutIntent } = await import("../../src/account/api");
  const request = vi
    .fn()
    .mockImplementation(async (url: string) =>
      Response.json(url === "/api/auth/get-session" ? { user: { id: "A" } } : {}),
    );
  vi.stubGlobal("fetch", request);
  const denied = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("denied", "SecurityError");
  });
  try {
    await expect(getAccountSession()).rejects.toThrow("Sign-out recovery is needed");
    await recoverSignOutIntent();
    expect(request).toHaveBeenCalledWith(
      "/api/auth/sign-out",
      expect.objectContaining({ headers: { "X-Chess-Account": "A" } }),
    );
    await expect(getAccountSession()).resolves.toMatchObject({ id: "A" });
  } finally {
    denied.mockRestore();
  }
});
