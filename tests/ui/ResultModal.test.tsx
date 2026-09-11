import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ResultModal } from "../../src/ui/Modals";
import { freshGame, reduceGame } from "../../src/game/state";
import { fromFEN } from "../../src/engine/board";

it("keeps takeback unavailable after a bare-king timeout draw", () => {
  const game = reduceGame(
    {
      ...freshGame({ playerColor: "w", level: "club", time: "5+0" }, 0, "timeout"),
      started: true,
      clocks: { w: 1, b: 1000 },
      st: fromFEN("4k3/8/8/8/8/8/8/3QK3 w - - 0 1"),
    },
    { type: "tick", now: 2 },
  );
  render(
    <ResultModal
      game={game}
      onNew={() => {}}
      onReview={() => {}}
      onUndo={() => {}}
      onDismiss={() => {}}
    />,
  );
  expect(screen.getByText("Draw")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Take back last move" })).toBeNull();
  expect(screen.getByRole("button", { name: "Review game" })).toBeTruthy();
});
