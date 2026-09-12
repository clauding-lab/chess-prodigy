import { renderPlayingApp as render } from "./enter-playing-app";
import React from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../../src/App";
import { freshSession, reduceSession } from "../../src/game/state";
import { archiveGame } from "../../src/game/archive";
import {
  morphyConfig,
  ratedMorphyConfig,
  historicalMorphyConfig,
} from "../../src/engine/opponents";
import { legalMoves } from "../../src/engine/board";
import { GUEST_HISTORY_KEY } from "../../src/storage/history";
import { SAVE_KEY } from "../../src/storage/store";
import type { RequestInput } from "../../src/worker/protocol";
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
function terminal(color: "w" | "b" = "w", beta = true) {
  const now = Date.now();
  let s = reduceSession(freshSession(now, "initial"), {
    type: "new",
    id: "completed",
    now,
    setup: {
      playerColor: color,
      level: "strong",
      time: "15+10",
      ...(beta ? { opponent: morphyConfig(7) } : {}),
    },
  });
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now });
  s = reduceSession(s, { type: "resign", now: now + 1 });
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  return s;
}
it.each(["w", "b"] as const)(
  "rematches Morphy as %s with retained settings, fresh identity and unchanged rating",
  (color) => {
    const prior = terminal(color);
    render(<App />);
    const result = screen.getByRole("dialog", { name: "Resignation" });
    expect(within(result).getByRole("region", { name: "Recorded rivalry" }).textContent).toContain(
      "1 recorded game",
    );
    fireEvent.click(within(result).getByRole("button", { name: "Rematch" }));
    const setup = screen.getByRole("dialog", { name: "New game" });
    expect(
      within(setup).getByRole("button", { name: "Paul Morphy" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(setup)
        .getByRole("button", { name: color === "w" ? "White" : "Black" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(within(setup).getByRole("button", { name: "Strong" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      within(setup).getByRole("button", { name: "15 | 10" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(within(setup).getByRole("button", { name: "Start" }));
    expect(saved().game.id).not.toBe(prior.game.id);
    expect(saved().game.opponent).toMatchObject({
      ...prior.game.opponent,
      seed: expect.any(Number),
    });
    expect(saved().game.opponent.seed).not.toBe(7);
    expect(saved().rating).toEqual(prior.rating);
    expect(JSON.parse(localStorage.getItem(GUEST_HISTORY_KEY)!).games).toHaveLength(1);
  },
);
it("keeps Classic rating receipts unchanged across rematch and allows colour adjustment", () => {
  const prior = terminal("w", false);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
  fireEvent.click(screen.getByRole("button", { name: "Black" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(saved().rating).toEqual(prior.rating);
  expect(saved().game).toMatchObject({
    setup: { playerColor: "b", level: "strong", time: "15+10" },
    rated: true,
    ratingApplied: null,
  });
});
it("opens a historical rematch with an honest missing clock default", async () => {
  const s = terminal();
  const record = archiveGame(s)!;
  delete record.time;
  record.id = "older";
  record.completedAt = new Date(Date.parse(record.completedAt) - 10000).toISOString();
  localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify({ version: 1, games: [record] }));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "View board" }));
  fireEvent.click(screen.getByRole("button", { name: "Games" }));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Rematch recorded game 2" }));
  expect(screen.getByText(/Original clock setting was not recorded/).textContent).toContain(
    "earlier opponent",
  );
  expect(screen.getByRole("button", { name: "No clock" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
});
it("shows terminal preservation failure inside setup and preserves recovery state", () => {
  const prior = terminal();
  localStorage.setItem(GUEST_HISTORY_KEY, "broken archive");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  const setup = screen.getByRole("dialog", { name: "New game" });
  expect(within(setup).getByRole("alert").textContent).toContain("could not be saved");
  expect(within(setup).getByRole("button", { name: "Download recovery save" })).toBeTruthy();
  expect(saved().game.id).toBe(prior.game.id);
  expect(localStorage.getItem(GUEST_HISTORY_KEY)).toBe("broken archive");
});

it.each([1, 2, 3])(
  "rematches version %s with its original rating and explicitly selects current Morphy",
  (version) => {
    let s = terminal();
    s = reduceSession(s, {
      type: "new",
      id: "versioned",
      now: Date.now(),
      setup: {
        playerColor: "w",
        level: "strong",
        time: "none",
        opponent: (version === 1
          ? morphyConfig
          : version === 2
            ? ratedMorphyConfig
            : historicalMorphyConfig)(8),
      },
    });
    s = reduceSession(s, {
      type: "move",
      move: legalMoves(s.game.st)[0],
      book: false,
      now: Date.now(),
    });
    s = reduceSession(s, { type: "resign", now: Date.now() });
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rematch", exact: true }));
    const setup = screen.getByRole("dialog", { name: "New game" });
    const strong = within(setup).getByRole("button", {
      name: version === 1 ? "Strong" : version === 2 ? "Strong 1825" : "Strong 1775",
      exact: true,
    });
    expect(strong.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(setup).getByRole("button", { name: "Start", exact: true }));
    expect(saved().game.opponent.version).toBe(version);
    expect(saved().game.rated).toBe(version !== 1);
    expect(saved().rating).toEqual(s.rating);
    fireEvent.click(screen.getByRole("button", { name: "New game", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Paul Morphy", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Start", exact: true }));
    expect(saved().game.opponent.version).toBe(3);
  },
);
