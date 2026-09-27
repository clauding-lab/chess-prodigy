import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "../../src/ui/Board";

const board = Array<string | null>(64).fill(null);
board[52] = "wp";

describe("Board keyboard controls", () => {
  it("slides both castling pieces and cancels their animations on unmount", () => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    const original = Element.prototype.animate;
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const before = Array<string | null>(64).fill(null);
    before[60] = "wk";
    before[63] = "wr";
    const props = {
      board: before,
      flipped: false,
      selected: null,
      targets: [],
      lastMove: null,
      hint: null,
      checkedKing: null,
      onSquare: vi.fn(),
      ply: 10,
    };
    const view = render(<Board {...props} />);
    const after = [...before];
    after[60] = null;
    after[63] = null;
    after[62] = "wk";
    after[61] = "wr";
    view.rerender(<Board {...props} board={after} lastMove={{ from: 60, to: 62 }} ply={11} />);
    expect(animate).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
    Element.prototype.animate = original;
  });
  it("animates a new move but not a restored position, undo or board flip", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    const original = Element.prototype.animate;
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    const props = {
      board,
      flipped: false,
      selected: null,
      targets: [],
      lastMove: null,
      hint: null,
      checkedKing: null,
      onSquare: vi.fn(),
      ply: 0,
    };
    const view = render(<Board {...props} />);
    expect(animate).not.toHaveBeenCalled();
    const after = [...board];
    after[52] = null;
    after[36] = "wp";
    view.rerender(<Board {...props} board={after} lastMove={{ from: 52, to: 36 }} ply={1} />);
    expect(animate).toHaveBeenCalledTimes(1);
    view.rerender(
      <Board {...props} board={after} lastMove={{ from: 52, to: 36 }} ply={1} flipped />,
    );
    view.rerender(<Board {...props} />);
    expect(animate).toHaveBeenCalledTimes(1);
    view.unmount();
    Element.prototype.animate = original;
  });
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

  it("keeps keyboard focus through a disabled reply and promotion transition", () => {
    const onSquare = vi.fn();
    const props = {
      board,
      flipped: false,
      selected: null,
      targets: [],
      lastMove: null,
      hint: null,
      checkedKing: null,
      onSquare,
    };
    const view = render(<Board {...props} />);
    const square = screen.getByRole("button", { name: "e2, white pawn" });
    square.focus();
    view.rerender(<Board {...props} disabled />);
    expect(document.activeElement).toBe(square);
    expect(square.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(square);
    fireEvent.keyDown(square, { key: "Enter" });
    expect(onSquare).not.toHaveBeenCalled();
    fireEvent.keyDown(square, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "e3, empty" }));
    view.rerender(<Board {...props} />);
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onSquare).toHaveBeenCalledWith(44);
  });
});
