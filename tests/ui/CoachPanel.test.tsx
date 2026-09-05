import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CoachPanel } from "../../src/ui/CoachPanel";
import { freshSession, reduceSession } from "../../src/game/state";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";

function play(sans: string[]) {
  let session = freshSession(0, "stories");
  for (const san of sans) {
    const move = legalMoves(session.game.st).find(
      (m) => sanFor(session.game.st, m, applyMove(session.game.st, m)) === san,
    )!;
    session = reduceSession(session, { type: "move", move, book: false, now: 0 });
  }
  return session.game;
}
const props = {
  playerColor: "w" as const,
  enabled: true,
  thinking: false,
  reviewing: false,
  hint: null,
  onToggle: vi.fn(),
  onHint: vi.fn(),
  onReview: vi.fn(),
};
it("retains earlier move stories and the expanded opening when later moves arrive", () => {
  const view = render(<CoachPanel {...props} game={play(["b3", "e5", "Bb2", "Nc6"])} />);
  const opening = screen.getByRole("button", { name: /About this opening/ });
  expect(opening.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: /2\. Bb2 · Fianchetto/ }));
  expect(opening.getAttribute("aria-expanded")).toBe("true");
  view.rerender(
    <CoachPanel {...props} game={play(["b3", "e5", "Bb2", "Nc6", "e3", "Nf6", "Nf3", "d6"])} />,
  );
  expect(
    screen.getByRole("button", { name: /2\. Bb2 · Fianchetto/ }).getAttribute("aria-expanded"),
  ).toBe("true");
  expect(screen.getByRole("link", { name: /Nimzowitsch-Larsen/ }).closest("button")).toBe(null);
  view.unmount();
  render(
    <CoachPanel {...props} game={play(["b3", "e5", "Bb2", "Nc6", "e3", "Nf6", "Nf3", "d6"])} />,
  );
  expect(screen.getByRole("button", { name: /2\. Bb2 · Fianchetto/ })).toBeTruthy();
});
