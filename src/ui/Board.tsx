import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export const GLYPH = { k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎" } as const;
const FILES = "abcdefgh";
const PIECE_NAME = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
} as const;

type Piece = string | null;
type MoveLike = { from: number; to: number; ep?: boolean; capture?: string | null };

export interface BoardProps {
  board: Piece[];
  flipped: boolean;
  selected: number | null;
  targets: MoveLike[];
  lastMove: MoveLike | null;
  hint: { move: MoveLike } | null;
  checkedKing: number | null;
  onSquare(square: number): void;
  onEscape?(): void;
  disabled?: boolean;
  ply?: number;
}

function squareName(square: number) {
  return `${FILES[square % 8]}${8 - Math.floor(square / 8)}`;
}

function label(square: number, piece: Piece) {
  if (!piece) return `${squareName(square)}, empty`;
  const colour = piece[0] === "w" ? "white" : "black";
  const name = PIECE_NAME[piece[1] as keyof typeof PIECE_NAME] ?? "piece";
  return `${squareName(square)}, ${colour} ${name}`;
}

export function Board({
  board,
  flipped,
  selected,
  targets,
  lastMove,
  hint,
  checkedKing,
  onSquare,
  onEscape,
  disabled = false,
  ply = 0,
}: BoardProps) {
  const initial = flipped ? 63 : 0;
  const [focusSquare, setFocusSquare] = useState(initial);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const previous = useRef({ board, flipped, ply });
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { board, flipped, ply };
    if (before.flipped !== flipped || ply !== before.ply + 1 || !lastMove) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const moves = [{ from: lastMove.from, to: lastMove.to }];
    // Castling moves the rook as well as the king.
    if (before.board[lastMove.from]?.[1] === "k" && Math.abs(lastMove.to - lastMove.from) === 2) {
      const kingside = lastMove.to > lastMove.from;
      moves.push({
        from: lastMove.from + (kingside ? 3 : -4),
        to: lastMove.from + (kingside ? 1 : -1),
      });
    }
    const animations: Animation[] = [];
    for (const move of moves) {
      const from = refs.current[move.from]?.getBoundingClientRect();
      const to = refs.current[move.to]?.getBoundingClientRect();
      const piece = refs.current[move.to]?.querySelector<HTMLElement>(".pc");
      if (!from || !to || !piece?.animate) continue;
      animations.push(
        piece.animate(
          [
            { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      );
    }
    return () => animations.forEach((animation) => animation.cancel());
  }, [board, flipped, ply, lastMove]);

  useEffect(
    () => setFocusSquare((current) => (current >= 0 && current < 64 ? current : initial)),
    [flipped, initial],
  );

  function moveFocus(displayDelta: number) {
    const currentDisplay = flipped ? 63 - focusSquare : focusSquare;
    const row = Math.floor(currentDisplay / 8);
    const col = currentDisplay % 8;
    const nextDisplay =
      displayDelta === -8 || displayDelta === 8
        ? ((row + displayDelta / 8 + 8) % 8) * 8 + col
        : row * 8 + ((col + displayDelta + 8) % 8);
    const next = flipped ? 63 - nextDisplay : nextDisplay;
    setFocusSquare(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, square: number) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-8);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(8);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabled) onSquare(square);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
    }
  }

  return (
    <div className="board" role="group" aria-label="Chess board">
      {Array.from({ length: 64 }, (_, displayIndex) => {
        const square = flipped ? 63 - displayIndex : displayIndex;
        const row = Math.floor(square / 8),
          col = square % 8,
          piece = board[square] ?? null;
        const isTarget = targets.some((move) => move.to === square);
        const isCapture =
          isTarget && (!!piece || targets.some((move) => move.to === square && move.ep));
        const classes = ["sq", (row + col) % 2 ? "dark" : "light"];
        if (lastMove && (lastMove.from === square || lastMove.to === square)) classes.push("last");
        if (hint && (hint.move.from === square || hint.move.to === square)) classes.push("hint");
        if (selected === square) classes.push("sel");
        if (checkedKing === square) classes.push("check");
        return (
          <button
            aria-label={label(square, piece)}
            aria-pressed={selected === square}
            className={classes.join(" ")}
            disabled={disabled}
            key={square}
            onClick={() => onSquare(square)}
            onFocus={() => setFocusSquare(square)}
            onKeyDown={(event) => onKeyDown(event, square)}
            ref={(node) => {
              refs.current[square] = node;
            }}
            tabIndex={focusSquare === square ? 0 : -1}
            type="button"
          >
            {displayIndex % 8 === 0 && (
              <span aria-hidden="true" className="coord rank">
                {8 - row}
              </span>
            )}
            {Math.floor(displayIndex / 8) === 7 && (
              <span aria-hidden="true" className="coord file">
                {FILES[col]}
              </span>
            )}
            {piece && (
              <span aria-hidden="true" className={`pc ${piece[0]}`}>
                {GLYPH[piece[1] as keyof typeof GLYPH]}
              </span>
            )}
            {isTarget && !isCapture && <span aria-hidden="true" className="dot" />}
            {isCapture && <span aria-hidden="true" className="ring" />}
          </button>
        );
      })}
    </div>
  );
}
