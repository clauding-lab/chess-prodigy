import { renderPlayingApp as render } from "./enter-playing-app";
import React from "react";
import { act, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../src/App";
import { freshSession, reduceSession } from "../../src/game/state";
import { morphyConfig } from "../../src/engine/opponents";
import { legalMoves } from "../../src/engine/board";
import { SAVE_KEY } from "../../src/storage/store";
import type { RequestInput } from "../../src/worker/protocol";
import { executeEngineRequest } from "../../src/worker/execute";
const jobs = vi.hoisted(() => [] as RequestInput[]);
const pwa = vi.hoisted(() => ({ need: false, update: vi.fn() }));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [pwa.need, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: pwa.update,
  }),
}));
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    async request(input: RequestInput) {
      jobs.push(input);
      return executeEngineRequest({ ...input, requestId: jobs.length });
    }
    cancel() {}
    dispose() {}
  },
}));
beforeEach(() => {
  localStorage.clear();
  jobs.length = 0;
  pwa.need = false;
  pwa.update.mockClear();
  vi.stubEnv("VITE_PERSONALITY_BETA", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY)!);

it("hides new Morphy selection in an ordinary build and keeps Classic explicit", () => {
  render(<App />);
  expect(screen.queryByRole("button", { name: "Paul Morphy", exact: true })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Classic", exact: true }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  expect(saved().game.opponent.id).toBe("classic");
  expect(screen.getByText(/Practice Rating/)).toBeTruthy();
});

it.each(["White", "Black"])(
  "plays and resumes Morphy as %s with independent difficulty and correct flipped labels",
  async (color) => {
    vi.stubEnv("VITE_PERSONALITY_BETA", "true");
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Paul Morphy", exact: true }));
    expect(within(screen.getByRole("dialog")).getByText("Attack & development")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: color, exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Casual 1200", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
    if (color === "White") {
      fireEvent.click(screen.getByRole("button", { name: "e2, white pawn" }));
      fireEvent.click(screen.getByRole("button", { name: "e4, empty" }));
    }
    await waitFor(() => expect(saved().game.hist.length).toBe(color === "White" ? 2 : 1), {
      timeout: 4000,
    });
    const before = saved();
    expect(before.game).toMatchObject({
      rated: true,
      ratingApplied: null,
      unratedReason: null,
      opponent: { id: "attack-development", version: 2 },
    });
    expect(before.rating.games).toBe(0);
    expect(screen.getByText("Paul Morphy · Casual")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Flip", exact: true }));
    expect(screen.getByText("Paul Morphy · Casual")).toBeTruthy();
    expect(screen.queryByText(/Unrated beta/)).toBeNull();
    const ai = jobs.find((job) => job.type === "ai")!;
    expect(ai).toMatchObject({ opponent: before.game.opponent });
    for (const job of jobs.filter((job) => job.type === "analyse"))
      expect(job).not.toHaveProperty("opponent");
    view.unmount();
    vi.stubEnv("VITE_PERSONALITY_BETA", "false");
    render(<App />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().game.opponent).toEqual(before.game.opponent);
    expect(screen.getByText("Paul Morphy · Casual")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resign", exact: true }));
    const confirm = screen.getByRole("dialog", { name: "Resign this game?" });
    expect(confirm.textContent).toContain("rating adjusted");
    fireEvent.click(within(confirm).getByRole("button", { name: "Resign", exact: true }));
    const result = screen.getByRole("dialog", { name: "Resignation" });
    expect(result.textContent).not.toContain("Unrated beta");
    expect(result.textContent).not.toContain("takeback used");
    expect(saved().rating.games).toBe(before.rating.games + 1);
  },
);

it("presents unavailable saved versions as read-only with a recovery download, preserving original bytes", async () => {
  let s = freshSession(Date.now(), "future");
  s = reduceSession(s, {
    type: "new",
    id: "future",
    now: Date.now(),
    setup: { playerColor: "w", level: "club", time: "none", opponent: morphyConfig(1) },
  });
  s = reduceSession(s, {
    type: "move",
    move: legalMoves(s.game.st)[0],
    book: false,
    now: Date.now(),
  });
  s.game.opponent.version = 99;
  const raw = JSON.stringify(s);
  localStorage.setItem(SAVE_KEY, raw);
  render(<App />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText(/saved opponent version is unavailable/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download recovery save" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "New game", exact: true }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => {});
  expect(jobs).toEqual([]);
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
});

it("resumes a saved beta before its first move even with the flag disabled", () => {
  let s = freshSession(Date.now(), "initial");
  s = reduceSession(s, {
    type: "new",
    id: "unstarted-beta",
    now: Date.now(),
    setup: { playerColor: "w", level: "club", time: "none", opponent: morphyConfig(2) },
  });
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  render(<App />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Paul Morphy · Club")).toBeTruthy();
  expect(saved().game.id).toBe("unstarted-beta");
});

it("allows an explicit compatible-app update for a read-only game only after recovery export", () => {
  const s = freshSession(Date.now(), "unavailable-update");
  s.game.opponent.version = 99;
  const raw = JSON.stringify(s);
  localStorage.setItem(SAVE_KEY, raw);
  pwa.need = true;
  const create = vi.fn(() => "blob:recovery");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = vi.fn();
    },
  );
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Update now", exact: true }));
  expect(pwa.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Download recovery save" }));
  expect(create).toHaveBeenCalledOnce();
  expect(click).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Update now", exact: true }));
  expect(pwa.update).toHaveBeenCalledWith(true);
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
});
