import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { freshSession } from "../../src/game/state";
import { Home } from "../../src/ui/Home";
import { setupFromDraft, type SetupDraft } from "../../src/ui/Modals";
import { chigorinConfig } from "../../src/engine/opponents";
import { canRematch } from "../../src/ui/RecordedGames";

const draft = { color: "w", level: "club", time: "none", opponentId: "chigorin" } as SetupDraft;
it("enables measured Chigorin setup and exact-identity rematches", () => {
  expect(setupFromDraft(draft, true).opponent).toMatchObject({
    ...chigorinConfig(0),
    seed: expect.any(Number),
  });
  expect(canRematch({ opponent: chigorinConfig(7) }, true)).toBe(true);
});
it("rejects Chigorin with the personality flag disabled and unknown rematch versions", () => {
  expect(() => setupFromDraft(draft, false)).toThrow(/disabled/);
  expect(() => setupFromDraft({ ...draft, opponentVersion: 2 }, true)).toThrow(/unavailable/);
});
it("shows Chigorin's concise card, Wikipedia link and enabled play button on Home", () => {
  const session = freshSession(0, "home");
  render(
    <Home
      {...session}
      betaEnabled
      canResume={false}
      onPlay={() => {}}
      onResume={() => {}}
      onResult={() => {}}
      onGames={() => {}}
      onTheme={() => {}}
    />,
  );
  expect(screen.getByRole("heading", { name: "Mikhail Chigorin" })).toBeTruthy();
  expect(screen.getByText(/active knights, central counterplay/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /Chigorin on Wikipedia/i }).getAttribute("href")).toBe(
    "https://en.wikipedia.org/wiki/Mikhail_Chigorin",
  );
  expect(
    screen.getByRole("button", { name: "Play Mikhail Chigorin" }).hasAttribute("disabled"),
  ).toBe(false);
  expect(screen.queryByText("Strength measurement in progress.")).toBeNull();
});
