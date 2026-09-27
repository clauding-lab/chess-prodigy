import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../../src/App";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import type { RequestInput } from "../../src/worker/protocol";
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    async request(input: RequestInput) {
      return { move: legalMoves(input.position)[0], score: 0, book: false };
    }
    cancel() {}
    dispose() {}
  },
}));
vi.mock("../../src/game/sound", () => ({ playSound() {}, silenceSound() {}, activateSound() {} }));
afterEach(() => vi.useRealTimers());
it("keeps an unstarted timed computer game paused on Home and while multiplayer hides setup", async () => {
  vi.useFakeTimers();
  let session = reduceSession(freshSession(Date.now(), "initial"), {
    type: "new",
    id: "setup-pause",
    now: Date.now(),
    setup: { playerColor: "b", level: "club", time: "5+0" },
  });
  session.preferences.coach = false;
  const storage = {
    load: () => ({ session, status: "saved" as const }),
    save: vi.fn((next: typeof session) => {
      session = next;
      return true;
    }),
  };
  const view = render(<App storage={storage} />);
  await act(async () => vi.advanceTimersByTimeAsync(1200));
  expect(session.game.started).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
  expect(screen.getByRole("dialog", { name: "New game" })).toBeTruthy();
  view.rerender(<App storage={storage} suspended />);
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(session.game.hist).toHaveLength(0);
  expect(session.game.started).toBe(false);
  expect(session.game.clocks).toEqual({ w: 300000, b: 300000 });
});
