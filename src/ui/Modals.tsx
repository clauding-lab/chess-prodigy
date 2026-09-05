import { GLYPH } from "./Board";
import { Modal } from "./Modal";
import { ENGINE_ELO, LEVEL_LABEL } from "../rating/fide";
import { TIME_CONTROLS } from "../game/state";
import { bookLookup } from "../book/book";
import { MOTIFS } from "../coach/motifs";
import type { Color, Level, Move } from "../engine/types";
import type { Game, Setup, TimeControl } from "../game/types";
import type { ReactNode } from "react";

export type SetupDraft = { color: Color | "rand"; level: Level; time: TimeControl };
export interface Confirmation {
  title: string;
  body: string;
  yes: string;
  onYes(): void;
  cancel?: string;
}
const moveLabel = (k: number) => `${Math.floor(k / 2) + 1}${k % 2 === 0 ? "." : "..."}`;

export function SetupModal({
  draft,
  setDraft,
  game,
  onStart,
  onCancel,
  accountControls,
}: {
  draft: SetupDraft;
  setDraft(value: SetupDraft): void;
  game: Game;
  onStart(): void;
  onCancel?: () => void;
  accountControls?: ReactNode;
}) {
  return (
    <Modal closeOnBackdrop={false} closeOnEscape={!!onCancel} onClose={onCancel} title="New game">
      {game.started && !game.over && game.rated && (
        <div className="note">
          A rated game is in progress. Starting a new one records it as a loss, as an abandoned game
          would be.
        </div>
      )}
      <div className="optrow">
        <span className="opt-label">Play as</span>
        <div className="seg">
          {(
            [
              ["w", "White"],
              ["b", "Black"],
              ["rand", "Random"],
            ] as const
          ).map(([v, l]) => (
            <button
              aria-pressed={draft.color === v}
              className={`btn${draft.color === v ? " on" : ""}`}
              key={v}
              onClick={() => setDraft({ ...draft, color: v })}
              type="button"
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="optrow">
        <span className="opt-label">Engine strength</span>
        <div className="seg">
          {(["casual", "club", "strong"] as const).map((v) => (
            <button
              aria-pressed={draft.level === v}
              className={`btn${draft.level === v ? " on" : ""}`}
              key={v}
              onClick={() => setDraft({ ...draft, level: v })}
              type="button"
            >
              {LEVEL_LABEL[v]}
              <br />
              <span className="subtext">{ENGINE_ELO[v]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="optrow">
        <span className="opt-label">Time control</span>
        <div className="seg">
          {(Object.keys(TIME_CONTROLS) as TimeControl[]).map((v) => (
            <button
              aria-pressed={draft.time === v}
              className={`btn${draft.time === v ? " on" : ""}`}
              key={v}
              onClick={() => setDraft({ ...draft, time: v })}
              type="button"
            >
              {TIME_CONTROLS[v].label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn primary full" onClick={onStart} type="button">
        Start
      </button>
      {accountControls && <div className="setup-account-controls">{accountControls}</div>}
      {onCancel && (
        <button className="btn full spaced" onClick={onCancel} type="button">
          Cancel
        </button>
      )}
    </Modal>
  );
}

export function PromotionModal({
  moves,
  color,
  onPick,
}: {
  moves: Move[];
  color: Color;
  onPick(move: Move): void;
}) {
  const names = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;
  return (
    <Modal closeOnBackdrop={false} closeOnEscape={false} title="Promote to">
      <div className="promo">
        {moves.map((m) => (
          <button
            aria-label={`Promote to ${names[m.promo!]}`}
            className="btn"
            key={m.promo}
            onClick={() => onPick(m)}
            type="button"
          >
            <span aria-hidden="true" className={`pc ${color}`}>
              {GLYPH[m.promo!]}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ResultModal({
  game,
  onNew,
  onReview,
  onUndo,
  onDismiss,
}: {
  game: Game;
  onNew(): void;
  onReview(): void;
  onUndo(): void;
  onDismiss(): void;
}) {
  const player = game.setup.playerColor,
    won = (game.over?.result === "1-0" ? "w" : "b") === player;
  return (
    <Modal
      className="result"
      closeOnBackdrop={false}
      closeOnEscape={false}
      title={game.over?.reason ?? "Game over"}
    >
      <div className="big">{game.over?.result}</div>
      <div className="why">
        {game.over?.result === "½-½" ? "Draw" : won ? "You win" : "Engine wins"}
      </div>
      {game.ratingApplied && (
        <div className="why">
          Rating{" "}
          <span className={`delta ${game.ratingApplied.delta >= 0 ? "up" : "down"}`}>
            {game.ratingApplied.delta >= 0 ? "+" : ""}
            {game.ratingApplied.delta.toFixed(1)}
          </span>{" "}
          → {Math.round(game.ratingApplied.after)}
        </div>
      )}
      {!game.rated && (
        <div className="why">Unrated game ({game.hintUsed ? "hint used" : "takeback used"})</div>
      )}
      <button className="btn primary full" onClick={onNew} type="button">
        New game
      </button>
      <button className="btn full spaced" onClick={onReview} type="button">
        Review game
      </button>
      <button className="btn full spaced" onClick={onDismiss} type="button">
        View board
      </button>
      {game.over?.reason !== "Time out" && game.over?.reason !== "Resignation" && (
        <button className="btn full spaced" onClick={onUndo} type="button">
          Take back last move
        </button>
      )}
    </Modal>
  );
}

export function ReviewModal({
  game,
  reviewing,
  onClose,
}: {
  game: Game;
  reviewing: boolean;
  onClose(): void;
}) {
  const book = bookLookup(game.hist.map((e) => e.san));
  const items = game.hist
    .map((e, k) => ({ e, k }))
    .filter(({ e }) => ["?!", "?", "??", "!"].includes(e.ann ?? ""));
  return (
    <Modal
      onClose={onClose}
      title={<>Game review {reviewing && <span className="thinking quiet">analysing…</span>}</>}
    >
      {book.info && (
        <div className="note">
          {book.info.name} ({book.info.eco})
          {book.inBook ? "" : `, left the book at move ${Math.ceil((book.leftAt ?? 0) / 2)}`}.
        </div>
      )}
      <div className="review">
        {!items.length && (
          <div className="item">
            {reviewing
              ? "Working through the moves…"
              : "No turning points found. Either a clean game or a very short one."}
          </div>
        )}
        {items.map(({ e, k }) => (
          <div className="item" key={k}>
            <b>
              {moveLabel(k)} {e.san}
            </b>
            <span className={`ann ${e.ann === "!" ? "good" : e.ann === "?!" ? "dub" : "bad"}`}>
              {e.ann}
            </span>
            {e.better && (
              <>
                {" "}
                · better was <b>{e.better}</b>
              </>
            )}
            {!!e.motifs.length && (
              <div className="motif-list">{e.motifs.map((m) => MOTIFS[m.key].name).join(", ")}</div>
            )}
          </div>
        ))}
      </div>
      <button className="btn full spaced" onClick={onClose} type="button">
        Close
      </button>
    </Modal>
  );
}

export function ConfirmModal({ value, onCancel }: { value: Confirmation; onCancel(): void }) {
  return (
    <Modal onClose={onCancel} title={value.title}>
      <div className="note confirm-copy">{value.body}</div>
      <button className="btn primary full" onClick={value.onYes} type="button">
        {value.yes}
      </button>
      <button className="btn full spaced" onClick={onCancel} type="button">
        {value.cancel ?? "Keep playing"}
      </button>
    </Modal>
  );
}

export function setupFromDraft(draft: SetupDraft): Setup {
  return {
    playerColor: draft.color === "rand" ? (Math.random() < 0.5 ? "w" : "b") : draft.color,
    level: draft.level,
    time: draft.time,
  };
}
