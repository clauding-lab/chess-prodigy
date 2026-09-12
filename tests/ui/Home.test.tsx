import React, { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../src/App";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { SAVE_KEY } from "../../src/storage/store";
import { GUEST_HISTORY_KEY } from "../../src/storage/history";
import type { RequestInput } from "../../src/worker/protocol";
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    async request(input: RequestInput) {
      return { move: legalMoves(input.position)[0], score: 0, book: false, depth: 1 };
    }
    cancel() {}
    dispose() {}
  },
}));
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubEnv("VITE_PERSONALITY_BETA", "true");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const saved = () => JSON.parse(localStorage.getItem(SAVE_KEY)!);
function seed(timed = false, assisted = false) {
  let s = reduceSession(freshSession(Date.now(), "initial"), {
    type: "new",
    id: "unfinished",
    now: Date.now(),
    setup: { playerColor: "w", level: "club", time: timed ? "5+0" : "none" },
  });
  for (let i = 0; i < 2; i++)
    s = reduceSession(s, {
      type: "move",
      move: legalMoves(s.game.st)[0],
      book: false,
      now: Date.now(),
    });
  if (assisted) s = reduceSession(s, { type: "hint" });
  if (timed) s.game.clocks = { w: 1000, b: 300000 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  return s;
}
it("opens on an explanatory home, then chooses a measured opponent without an automatic dialog", () => {
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Chess with character." })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play Paul Morphy" }));
  const setup = screen.getByRole("dialog", { name: "New game" });
  expect(
    within(setup).getByRole("button", { name: "Paul Morphy" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(within(setup).getByRole("button", { name: "Start", exact: true }));
  expect(saved().game.opponent.version).toBe(2);
  expect(screen.getByRole("button", { name: "e2, white pawn" })).toBeTruthy();
});
it("requires resume or explicit forfeit before replacing a started game and records one loss", () => {
  const prior = seed();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  const gate = screen.getByRole("dialog", { name: "Finish your current game?" });
  expect(within(gate).getByText(/minimum/)).toBeTruthy();
  expect(saved().game.over).toBeNull();
  fireEvent.click(within(gate).getByRole("button", { name: "Resume game" }));
  expect(saved().game.id).toBe(prior.game.id);
  fireEvent.click(screen.getByRole("button", { name: "Home", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Play Paul Morphy" }));
  fireEvent.click(screen.getByRole("button", { name: "Forfeit and continue" }));
  expect(saved().game.over.reason).toBe("Abandoned");
  expect(saved().rating.games).toBe(1);
  expect(JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY)!).games).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  expect(saved().game.id).not.toBe(prior.game.id);
  expect(saved().rating.games).toBe(1);
});
it("requires confirmation for an assisted unfinished game and honestly shows no rating change", () => {
  seed(false, true);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  expect(screen.getByRole("dialog").textContent).toContain("No rating change");
  fireEvent.click(screen.getByRole("button", { name: "Forfeit and continue" }));
  expect(saved().rating.games).toBe(0);
  expect(saved().game.over.reason).toBe("Abandoned");
});
it("settles a closed-app timeout on Home once and offers the result instead of resume", async () => {
  seed(true);
  let view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(screen.getByRole("button", { name: "Resume game" })).toBeTruthy();
  view.unmount();
  vi.setSystemTime(Date.now() + 2000);
  view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(screen.queryByRole("button", { name: "Resume game" })).toBeNull();
  expect(screen.getByRole("button", { name: "View result" })).toBeTruthy();
  expect(saved().game.over.reason).toBe("Time out");
  expect(saved().rating.games).toBe(1);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  view.unmount();
  render(<App />);
  expect(saved().rating.games).toBe(1);
});
it("continues a running clock on Home and changes resume into a completed result", async () => {
  seed(true);
  render(<App />);
  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(screen.queryByRole("button", { name: "Resume game" })).toBeNull();
  expect(screen.getByRole("button", { name: "View result" })).toBeTruthy();
  expect(saved().rating.games).toBe(1);
});
it("expires while the forfeit decision is open without forfeiting again or reopening the gate", async () => {
  seed(true);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(saved().game.over.reason).toBe("Time out");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(saved().rating.games).toBe(1);
});
it("preserves the timed engine reply deadline through repeated Home and Resume navigation", async () => {
  let s = reduceSession(freshSession(Date.now(), "initial"), {
    type: "new",
    id: "timed-ai",
    now: Date.now(),
    setup: { playerColor: "w", level: "club", time: "5+0" },
  });
  s = reduceSession(s, {
    type: "move",
    move: legalMoves(s.game.st)[0],
    book: false,
    now: Date.now(),
  });
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  render(<App />);
  for (let i = 0; i < 4; i++) {
    await act(async () => vi.advanceTimersByTimeAsync(100));
    fireEvent.click(screen.getByRole("button", { name: "Resume game" }));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    fireEvent.click(screen.getByRole("button", { name: "Home", exact: true }));
  }
  await act(async () => vi.advanceTimersByTimeAsync(200));
  expect(saved().game.hist).toHaveLength(2);
  expect(saved().game.over).toBeNull();
});
it("keeps the forfeited terminal game and explains a failed archive before any replacement", () => {
  seed();
  const real = Storage.prototype.setItem;
  const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key === GUEST_HISTORY_KEY) throw new Error("full");
    real.call(this, key, value);
  });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Resume game", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Forfeit and continue", exact: true }));
  expect(saved().game.id).toBe("unfinished");
  expect(saved().game.over.reason).toBe("Abandoned");
  expect(screen.getByText(/Your result could not be saved/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download recovery save", exact: true })).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "New game" })).toBeNull();
  fail.mockRestore();
});
