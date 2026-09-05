import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "../../src/ui/Board";

const board = Array<string | null>(64).fill(null);
board[52] = "wp";

describe("Board keyboard controls", () => {
  it("keeps one square tabbable and moves focus in display coordinates", () => {
    render(
      <Board
        board={board}
        flipped={false}
        selected={null}
        targets={[]}
        lastMove={null}
        hint={null}
        checkedKing={null}
        onSquare={vi.fn()}
      />,
    );
    const e4 = screen.getByRole("button", { name: "e4, empty" });
    act(() => e4.focus());
    fireEvent.keyDown(e4, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "f4, empty" }));
    expect(document.querySelectorAll('.sq[tabindex="0"]')).toHaveLength(1);
  });

  it("activates a square with Enter and reverses horizontal navigation when flipped", () => {
    const onSquare = vi.fn();
    render(
      <Board
        board={board}
        flipped
        selected={null}
        targets={[]}
        lastMove={null}
        hint={null}
        checkedKing={null}
        onSquare={onSquare}
      />,
    );
    const e4 = screen.getByRole("button", { name: "e4, empty" });
    act(() => e4.focus());
    fireEvent.keyDown(e4, { key: "Enter" });
    expect(onSquare).toHaveBeenCalledWith(36);
    fireEvent.keyDown(e4, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "d4, empty" }));
  });
});
