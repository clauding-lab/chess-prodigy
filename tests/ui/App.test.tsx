import React, { StrictMode } from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import App from "../../src/App";
import { legalMoves } from "../../src/engine/board";
import type { RequestInput } from "../../src/worker/protocol";
import { freshSession, reduceSession } from "../../src/game/state";
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    async request(input: RequestInput) {
      return input.type === "ai"
        ? { move: legalMoves(input.position)[0], score: 0, book: false }
        : { move: legalMoves(input.position)[0], score: 0, depth: 1 };
    }
    cancel() {}
    dispose() {}
  },
}));
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

function seedTimedPlayerTurn(remaining = 100) {
  const now = Date.now();
  let session = freshSession(now, "initial");
  session = reduceSession(session, {
    type: "new",
    setup: { playerColor: "w", level: "club", time: "5+0" },
    now,
    id: "timed-game",
  });
  const white = legalMoves(session.game.st).find((move) => move.from === 52 && move.to === 36)!;
  session = reduceSession(session, { type: "move", move: white, book: true, now });
  const black = legalMoves(session.game.st)[0];
  session = reduceSession(session, { type: "move", move: black, book: false, now });
  session = {
    ...session,
    game: { ...session.game, clocks: { ...session.game.clocks!, w: remaining }, clockAt: now },
  };
  localStorage.setItem("chess-prodigy-state-v2", JSON.stringify(session));
}
it("starts, plays a legal move, receives an engine reply and preserves theme across reload", async () => {
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  expect(view.container.querySelector(".app")?.getAttribute("data-theme")).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "e2, white pawn" }));
  fireEvent.click(screen.getByRole("button", { name: "e4, empty" }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!).game.hist).toHaveLength(2),
  );
  fireEvent.click(screen.getByRole("button", { name: "Wooden board" }));
  view.unmount();
  render(<App />);
  expect(screen.getByRole("button", { name: "Dark board" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start", exact: true })).toBe(null);
  expect(screen.getByRole("button", { name: "e4, white pawn" })).toBeTruthy();
});
it("keeps new-game cancellation available even before the first move", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(screen.queryByRole("dialog")).toBe(null);
});
it("marks setup choices as pressed and supports a keyboard board move", () => {
  render(<App />);
  const black = screen.getByRole("button", { name: "Black" });
  expect(black.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(black);
  expect(black.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "White" }));
  fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
  const pawn = screen.getByRole("button", { name: "e2, white pawn" });
  pawn.focus();
  fireEvent.keyDown(pawn, { key: "Enter" });
  expect(pawn.getAttribute("aria-pressed")).toBe("true");
  const target = screen.getByRole("button", { name: "e4, empty" });
  fireEvent.keyDown(target, { key: "Enter" });
  expect(screen.getByRole("button", { name: "e4, white pawn" })).toBeTruthy();
});
it("replaces an obsolete confirmation with the result when time expires", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T12:00:00+06:00"));
  seedTimedPlayerTurn();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Resign" }));
  expect(screen.getByRole("dialog", { name: "Resign this game?" })).toBeTruthy();
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(screen.queryByRole("dialog", { name: "Resign this game?" })).toBe(null);
  expect(screen.getByRole("dialog", { name: "Time out" })).toBeTruthy();
});
it("lets the player dismiss a result to inspect the final board", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T12:00:00+06:00"));
  seedTimedPlayerTurn(0);
  render(<App />);
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(screen.getByRole("dialog", { name: "Time out" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View board" }));
  expect(screen.queryByRole("dialog")).toBe(null);
  expect(screen.getByText("Time out · 0-1")).toBeTruthy();
});

it("keeps timed computer replies running while the player views friend games", async () => {
  vi.useFakeTimers();
  const now = Date.now();
  let session = freshSession(now, "background-timed");
  session = reduceSession(session, {
    type: "new",
    setup: { playerColor: "w", level: "club", time: "5+0" },
    now,
    id: "background-timed",
  });
  session = reduceSession(session, {
    type: "move",
    move: legalMoves(session.game.st).find((m) => m.from === 52 && m.to === 36)!,
    book: true,
    now,
  });
  session = { ...session, game: { ...session.game, clocks: { w: 10000, b: 2500 } } };
  localStorage.setItem("chess-prodigy-state-v2", JSON.stringify(session));
  render(<App suspended />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  const saved = JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!);
  expect(saved.game.hist).toHaveLength(2);
  expect(saved.game.over).toBeNull();
});

it.each([1400, 1500.25])(
  "previews abandonment at rating %s and preserves it when the player keeps playing",
  async (value) => {
    seedTimedPlayerTurn(300000);
    const session = JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!);
    session.rating.rating = value;
    session.rating.peak = value;
    localStorage.setItem("chess-prodigy-state-v2", JSON.stringify(session));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
    expect(
      screen.getByText("Starting another game counts this unfinished game as a loss."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        value === 1400
          ? "Your rating stays at 1400 (the minimum), but this still counts as a rated loss."
          : "You will lose 28 displayed rating points: 1500 → 1472.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep playing", exact: true }));
    expect(JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!).rating.rating).toBe(value);
    fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: /Strong/ }));
    expect(
      screen.getByText(
        value === 1400
          ? "Your rating stays at 1400 (the minimum), but this still counts as a rated loss."
          : "You will lose 28 displayed rating points: 1500 → 1472.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abandon and start", exact: true }));
    const saved = JSON.parse(localStorage.getItem("chess-prodigy-state-v2")!);
    expect(Math.round(saved.rating.rating)).toBe(value === 1400 ? 1400 : 1472);
    expect(saved.rating.games).toBe(1);
    expect(saved.game.setup.level).toBe("strong");
  },
);
