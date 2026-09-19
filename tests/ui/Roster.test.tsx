import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ROSTER_IDS, ROSTER_NAMES, rosterConfig } from "../../src/engine/opponents";
import { freshSession } from "../../src/game/state";
import { Home } from "../../src/ui/Home";
import { SetupModal, setupFromDraft } from "../../src/ui/Modals";
import { canRematch } from "../../src/ui/RecordedGames";
afterEach(cleanup);
for (const id of ROSTER_IDS)
  test(`${id} setup and rematch remain closed before measurement`, () => {
    const draft = {
      color: "w" as const,
      level: "club" as const,
      time: "none" as const,
      opponentId: id,
    };
    expect(() => setupFromDraft(draft, true)).toThrow(/measurement/);
    expect(() => setupFromDraft(draft, false)).toThrow(/disabled/);
    expect(() => setupFromDraft({ ...draft, opponentVersion: 2 }, true)).toThrow(/unavailable/);
    expect(canRematch({ opponent: rosterConfig(id, 1) }, true)).toBe(false);
    render(
      <SetupModal
        draft={draft}
        setDraft={() => {}}
        {...freshSession(0, "x")}
        onStart={() => {}}
        betaEnabled
      />,
    );
    expect(screen.getByRole("button", { name: "Start" }).hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("button", { name: ROSTER_NAMES[id] }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Classic" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
test("six cards preserve Wikipedia access with new starts gated", () => {
  render(
    <Home
      {...freshSession(0, "home")}
      betaEnabled
      canResume={false}
      onPlay={() => {}}
      onResume={() => {}}
      onResult={() => {}}
      onGames={() => {}}
      onTheme={() => {}}
    />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(6);
  for (const id of ROSTER_IDS) {
    expect(
      screen.getByRole("button", { name: `Play ${ROSTER_NAMES[id]}` }).hasAttribute("disabled"),
    ).toBe(true);
    const link = screen.getByRole("link", { name: new RegExp(`${ROSTER_NAMES[id]} on Wikipedia`) });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("opens in a new tab");
  }
});
