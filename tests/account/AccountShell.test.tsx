import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountShell } from "../../src/account/AccountShell";
import { parseSessionInput } from "../../src/storage/input";
import { accountStorageKey } from "../../src/account/sync";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import type { RequestInput, EngineResult } from "../../src/worker/protocol";

const engine = vi.hoisted(() => ({
  jobs: [] as Array<{ input: RequestInput; resolve(result: EngineResult): void }>,
}));
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    request(input: RequestInput) {
      return new Promise<EngineResult>((resolve) => engine.jobs.push({ input, resolve }));
    }
    cancel() {}
    dispose() {}
  },
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>,
      ) => callback({}),
    },
  });
  engine.jobs = [];
  window.history.replaceState(null, "", "/");
});

it("renaming an account keeps its in-flight computer reply", async () => {
  let snapshot = freshSession(Date.now(), "active");
  snapshot.preferences.coach = false;
  snapshot = reduceSession(snapshot, {
    type: "move",
    move: legalMoves(snapshot.game.st)[0],
    book: false,
    now: Date.now(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/get-session")
        return Response.json({ user: { id: "user", name: "Player", email: "p@example.com" } });
      if (url === "/api/records") {
        const body = init?.method === "PUT" ? JSON.parse(String(init.body)) : null;
        return Response.json({
          version: body ? body.expectedVersion + 1 : 7,
          snapshot: body?.snapshot ?? snapshot,
          games: [],
          updatedAt: null,
        });
      }
      return Response.json({ games: [], opponents: [], rating: { rating: 1200, games: 0 } });
    }),
  );
  render(<AccountShell />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume game", exact: true }));
  await waitFor(() => expect(engine.jobs.some((job) => job.input.type === "ai")).toBe(true));
  const job = engine.jobs.find((entry) => entry.input.type === "ai")!;
  const count = engine.jobs.filter((entry) => entry.input.type === "ai").length;
  fireEvent.click(screen.getByRole("button", { name: "Player", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Edit name" }));
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await screen.findByRole("dialog", { name: "Renamed" });
  expect(engine.jobs.filter((entry) => entry.input.type === "ai")).toHaveLength(count);
  await act(async () =>
    job.resolve({ move: legalMoves(job.input.position)[0], score: 0, book: false }),
  );
  await waitFor(
    () =>
      expect(
        parseSessionInput(JSON.parse(localStorage.getItem(accountStorageKey("user"))!).snapshot)
          ?.game.hist,
      ).toHaveLength(2),
    { timeout: 2000 },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("offers retry without mounting a blank account when its first records download fails", async () => {
  let unavailable = true;
  const snapshot = freshSession(0, "actual-account");
  snapshot.rating.rating = 1575;
  snapshot.rating.peak = 1575;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/auth/get-session")
        return Response.json({ user: { id: "user", name: "Player", email: "p@example.com" } });
      if (url === "/api/records") {
        if (unavailable) throw new Error("offline");
        return Response.json({ version: 7, snapshot, games: [], updatedAt: null });
      }
      return Response.json({ games: [], opponents: [], rating: {} });
    }),
  );
  render(<AccountShell />);
  const retry = await screen.findByRole("button", { name: "Retry account download" });
  expect(localStorage.getItem(accountStorageKey("user"))).toBeNull();
  expect(screen.queryByText("Saved to account")).toBeNull();
  expect(screen.queryByRole("button", { name: "Play Classic" })).toBeNull();
  unavailable = false;
  fireEvent.click(retry);
  await screen.findByText("Saved to account");
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem(accountStorageKey("user"))!).snapshot.rating.rating,
    ).toBe(1575),
  );
});

it("offers recovery without claiming durability when account storage writes fail", async () => {
  const snapshot = freshSession(Date.now(), "memory-only");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/auth/get-session")
        return Response.json({ user: { id: "user", name: "Player", email: "p@example.com" } });
      if (url === "/api/records")
        return Response.json({ version: 7, snapshot, games: [], updatedAt: null });
      return Response.json({ games: [], opponents: [], rating: { rating: 1200, games: 0 } });
    }),
  );
  const failingWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  try {
    render(<AccountShell />);
    expect(await screen.findByText(/could not save all your changes/i)).toBeTruthy();
    expect(screen.queryByText(/queued games are preserved on this device/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Download recovery copy" })).toBeTruthy();
  } finally {
    failingWrite.mockRestore();
  }
});

it("blocks persistent gameplay when browser locks are unavailable", async () => {
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(null)),
  );
  render(<AccountShell />);
  expect(await screen.findByText(/cannot safely coordinate saved games/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Play Classic" })).toBeNull();
  expect(localStorage.length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Play temporarily without saving" }));
  expect(await screen.findByText(/temporary unrated play/i)).toBeTruthy();
  expect(localStorage.length).toBe(0);
});

it("does not initialize or download the account outbox before exclusive ownership", async () => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, _options: unknown, callback: (lock: null) => Promise<void>) =>
        callback(null),
    },
  });
  const fetcher = vi.fn(async (url: string) => {
    if (url === "/api/auth/get-session")
      return Response.json({ user: { id: "held", name: "Held", email: "held@example.com" } });
    throw Error("Records must not be opened without ownership");
  });
  vi.stubGlobal("fetch", fetcher);
  render(<AccountShell />);
  await screen.findByText(/open in another tab/);
  expect(fetcher.mock.calls.map(([url]) => url)).not.toContain("/api/records");
  expect(localStorage.getItem(accountStorageKey("held"))).toBeNull();
  expect(screen.queryByText("Saved to account")).toBeNull();
});

function blockedAccountWithPush() {
  let grant = false;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object | null) => Promise<void>,
      ) => callback(grant ? {} : null),
    },
  });
  localStorage.setItem("chess-push-owner", "push-account");
  let finish!: (success: boolean) => void;
  const unsubscribe = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: async () => ({
        pushManager: { getSubscription: async () => ({ unsubscribe }) },
      }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/auth/get-session")
        return Response.json({
          user: { id: "push-account", name: "Push Player", email: "push@example.com" },
        });
      if (url === "/api/records")
        return Response.json({ version: 0, snapshot: null, games: [], updatedAt: null });
      return Response.json({ games: [], opponents: [], rating: { rating: 1200, games: 0 } });
    }),
  );
  return {
    unsubscribe,
    finish: (success: boolean) => finish(success),
    grant: () => {
      grant = true;
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

it("awaits push cancellation before a blocked account enters temporary guest play", async () => {
  const push = blockedAccountWithPush();
  render(<AccountShell />);
  fireEvent.click(await screen.findByRole("button", { name: "Play temporarily without saving" }));
  await waitFor(() => expect(push.unsubscribe).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Temporary unrated play/)).toBeNull();
  expect(localStorage.getItem("chess-push-owner")).toBe("push-account");
  await act(async () => push.finish(true));
  expect(await screen.findByText(/Temporary unrated play/)).toBeTruthy();
  expect(localStorage.getItem("chess-push-owner")).toBeNull();
  expect(localStorage.getItem(accountStorageKey("push-account"))).toBeNull();
});

it("preserves a blocked account identity when device push cancellation fails", async () => {
  const push = blockedAccountWithPush();
  render(<AccountShell />);
  fireEvent.click(await screen.findByRole("button", { name: "Play temporarily without saving" }));
  await waitFor(() => expect(push.unsubscribe).toHaveBeenCalledOnce());
  await act(async () => push.finish(false));
  expect(await screen.findByText(/Could not disable the previous account/)).toBeTruthy();
  expect(screen.queryByText(/Temporary unrated play/)).toBeNull();
  expect(screen.getByRole("button", { name: "Take over in this tab" })).toBeTruthy();
  expect(localStorage.getItem("chess-push-owner")).toBe("push-account");
});

it("ignores late temporary-play completion after a newer account takeover", async () => {
  const push = blockedAccountWithPush();
  render(<AccountShell />);
  fireEvent.click(await screen.findByRole("button", { name: "Play temporarily without saving" }));
  await waitFor(() => expect(push.unsubscribe).toHaveBeenCalledOnce());
  push.grant();
  fireEvent.click(screen.getByRole("button", { name: "Take over in this tab" }));
  expect(await screen.findByRole("button", { name: "Push Player", exact: true })).toBeTruthy();
  await act(async () => push.finish(true));
  expect(screen.queryByText(/Temporary unrated play/)).toBeNull();
  expect(screen.getByRole("button", { name: "Push Player", exact: true })).toBeTruthy();
});

it("keeps a mounted account and its pending copy when temporary push cancellation fails", async () => {
  const push = blockedAccountWithPush();
  push.grant();
  render(<AccountShell />);
  await screen.findByRole("button", { name: "Push Player", exact: true });
  const failing = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  try {
    fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Play temporarily without saving" }));
    await waitFor(() => expect(push.unsubscribe).toHaveBeenCalledOnce());
    await act(async () => push.finish(false));
    expect(await screen.findByText(/Could not disable the previous account/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Push Player", exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download recovery copy" })).toBeTruthy();
    expect(screen.queryByText(/Temporary unrated play/)).toBeNull();
    expect(localStorage.getItem("chess-push-owner")).toBe("push-account");
  } finally {
    failing.mockRestore();
  }
});

it("settles a closed account computer turn as unrated before offering resume", async () => {
  let snapshot = reduceSession(freshSession(Date.now() - 10000, "seed"), {
    type: "new",
    id: "closed-account",
    now: Date.now() - 10000,
    setup: { playerColor: "w", level: "club", time: "5+0" },
  });
  snapshot = reduceSession(snapshot, {
    type: "move",
    move: legalMoves(snapshot.game.st)[0],
    book: false,
    now: Date.now() - 9000,
  });
  snapshot.game.clocks = { w: 300000, b: 100 };
  snapshot.preferences.coach = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/get-session")
        return Response.json({
          user: { id: "user", name: "Player", email: "private@example.test" },
        });
      if (url === "/api/records") {
        const body = init?.method === "PUT" ? JSON.parse(String(init.body)) : null;
        return Response.json({
          version: body ? body.expectedVersion + 1 : 7,
          snapshot: body?.snapshot ?? snapshot,
          games: [],
          updatedAt: null,
        });
      }
      return Response.json({ games: [], opponents: [], rating: { rating: 1200, games: 0 } });
    }),
  );
  render(<AccountShell />);
  await waitFor(() => {
    const raw = localStorage.getItem(accountStorageKey("user"));
    expect(raw).not.toBeNull();
    const loaded = parseSessionInput(JSON.parse(raw!).snapshot)!;
    expect(loaded.game.over?.reason).toBe("Time out");
    expect(loaded.game.unratedReason).toBe("engine-interrupted");
    expect(loaded.game.ratingApplied).toBeNull();
    expect(loaded.rating).toEqual(snapshot.rating);
  });
  expect(screen.queryByRole("button", { name: "Resume game", exact: true })).toBeNull();
});
