import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountShell } from "../../src/account/AccountShell";
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
        JSON.parse(localStorage.getItem(accountStorageKey("user"))!).snapshot.game.hist,
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
