import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { freshSession } from "../../src/game/state";
import { Home } from "../../src/ui/Home";
import { setupFromDraft, type SetupDraft } from "../../src/ui/Modals";
import { chigorinConfig } from "../../src/engine/opponents";
import { canRematch } from "../../src/ui/RecordedGames";

const draft = { color: "w", level: "club", time: "none", opponentId: "chigorin" } as SetupDraft;
it("withholds Chigorin setup and rematches before accepted strength measurements", () => {
  expect(() => setupFromDraft(draft, true)).toThrow(/measurement/i);
  expect(canRematch({ opponent: chigorinConfig(7) }, true)).toBe(false);
});
it("rejects Chigorin with the personality flag disabled and unknown rematch versions", () => {
  expect(() => setupFromDraft(draft, false)).toThrow(/disabled/);
  expect(() => setupFromDraft({ ...draft, opponentVersion: 2 }, true)).toThrow(/unavailable/);
});
it("explains Chigorin on Home without enabling unmeasured games", () => {
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
  expect(
    screen.getByRole("button", { name: "Play Mikhail Chigorin" }).hasAttribute("disabled"),
  ).toBe(true);
});
