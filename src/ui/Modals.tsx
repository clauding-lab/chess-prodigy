import { GLYPH } from "./Board";
import { Modal } from "./Modal";
import { FIDE_FLOOR, LEVEL_LABEL, ratingUpdate, type Rating } from "../rating/fide";
import { TIME_CONTROLS } from "../game/state";
import { bookLookup } from "../book/book";
import { MOTIFS } from "../coach/motifs";
import type { Color, Level, Move } from "../engine/types";
import type { Game, Setup, TimeControl } from "../game/types";
import type { ReactNode } from "react";
import {
  CLASSIC,
  morphyConfig,
  ratedMorphyConfig,
  historicalMorphyConfig,
  opponentName,
} from "../engine/opponents";
import { opponentPracticeRating } from "../rating/opponents";
import { unratedDescription } from "../game/eligibility";
import type { HistoryResult } from "../storage/history";
import { RecordedRivalry } from "./RecordedGames";

export type SetupDraft = {
  color: Color | "rand";
  level: Level;
  time: TimeControl;
  opponentId?: "classic" | "attack-development";
  opponentVersion?: number;
};
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
  rating,
  onStart,
  onCancel,
  accountControls,
  betaEnabled = false,
  startError,
  rematchNote,
  onRecovery,
}: {
  draft: SetupDraft;
  setDraft(value: SetupDraft): void;
  game: Game;
  rating: Rating;
  onStart(): void;
  onCancel?: () => void;
  accountControls?: ReactNode;
  betaEnabled?: boolean;
  startError?: string | null;
  rematchNote?: string | null;
  onRecovery?(): void;
}) {
  const abandoning = game.started && !game.over && game.rated;
  const before = Math.round(rating.rating);
  const after = Math.round(
    game.rated && opponentPracticeRating(game.opponent, game.setup.level) !== null
      ? ratingUpdate(
          rating,
          opponentPracticeRating(game.opponent, game.setup.level)!,
          0,
          { opp: "" },
          0,
        ).next.rating
      : rating.rating,
  );
  const loss = before - after;
  const morphy = betaEnabled && draft.opponentId === "attack-development";
  const legacyMorphy = morphy && draft.opponentVersion === 1;
  const selectedOpponent = morphy
    ? legacyMorphy
      ? morphyConfig(0)
      : draft.opponentVersion === 2
        ? ratedMorphyConfig(0)
        : historicalMorphyConfig(0)
    : CLASSIC;
  return (
    <Modal closeOnBackdrop={false} closeOnEscape={!!onCancel} onClose={onCancel} title="New game">
      {rematchNote && <p className="note">{rematchNote}</p>}
      {morphy && (draft.opponentVersion === 1 || draft.opponentVersion === 2) && (
        <p className="note">
          This rematch keeps the earlier opponent. New Morphy games use his documented repertoire;
          select Paul Morphy above to switch.
        </p>
      )}
      {startError && (
        <div className="note" role="alert">
          {startError}{" "}
          {onRecovery && (
            <button className="linkbtn" type="button" onClick={onRecovery}>
              Download recovery save
            </button>
          )}
        </div>
      )}
      {abandoning && (
        <div className="note" role="status">
          <strong>Starting another game counts this unfinished game as a loss.</strong>
          <p>
            {rating.rating === FIDE_FLOOR
              ? `Your rating stays at ${FIDE_FLOOR} (the minimum), but this still counts as a rated loss.`
              : loss === 0
                ? `Your displayed rating stays at ${before}, but this still counts as a rated loss.`
                : `You will lose ${loss} displayed rating ${loss === 1 ? "point" : "points"}: ${before} → ${after}.`}
          </p>
          Choose Keep playing to return to this game.
        </div>
      )}
      <div className="optrow">
        <span className="opt-label">Opponent</span>
        <div className="seg">
          <button
            className={`btn${!morphy ? " on" : ""}`}
            aria-pressed={!morphy}
            onClick={() => setDraft({ ...draft, opponentId: "classic" })}
            type="button"
          >
            Classic
          </button>
          {betaEnabled && (
            <button
              className={`btn${morphy ? " on" : ""}`}
              aria-pressed={morphy}
              onClick={() =>
                setDraft({ ...draft, opponentId: "attack-development", opponentVersion: 3 })
              }
              type="button"
            >
              Paul Morphy
            </button>
          )}
        </div>
      </div>
      {morphy && (
        <div className="note" role="status">
          <strong>Attack &amp; development</strong>
          <p>
            {draft.opponentVersion === 1 || draft.opponentVersion === 2
              ? "A style-inspired simulation that favours active pieces and open lines."
              : "A historical simulation using recorded moves in matching positions and learned preferences elsewhere, drawn from 247 validated games."}
          </p>
          {legacyMorphy
            ? "This rematch uses the original unrated beta. Select Paul Morphy above to start a rated game."
            : "Rated practice — strength measured against Classic within this app. Hints and takebacks make the game unrated."}
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
        <span className="opt-label">Difficulty</span>
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
              {opponentPracticeRating(selectedOpponent, v) !== null && (
                <>
                  <br />
                  <span className="subtext">{opponentPracticeRating(selectedOpponent, v)}</span>
                </>
              )}
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
        {abandoning ? "Abandon and start" : "Start"}
      </button>
      {accountControls && <div className="setup-account-controls">{accountControls}</div>}
      {onCancel && (
        <button className="btn full spaced" onClick={onCancel} type="button">
          {abandoning ? "Keep playing" : "Cancel"}
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
  onRematch,
  rematchAvailable = true,
  history,
}: {
  game: Game;
  onNew(): void;
  onReview(): void;
  onUndo(): void;
  onDismiss(): void;
  onRematch?(): void;
  rematchAvailable?: boolean;
  history?: HistoryResult;
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
        {game.over?.result === "½-½"
          ? "Draw"
          : won
            ? "You win"
            : `${opponentName(game.opponent)} wins`}
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
      {!game.rated && <div className="why">{unratedDescription(game)}</div>}
      {history && (
        <RecordedRivalry
          history={history}
          target={{ opponent: game.opponent, level: game.setup.level }}
        />
      )}
      {onRematch && (
        <button
          className="btn primary full"
          onClick={onRematch}
          type="button"
          disabled={!rematchAvailable}
        >
          Rematch
        </button>
      )}
      {onRematch && !rematchAvailable && (
        <p className="quiet">New games against this opponent are unavailable in this build.</p>
      )}
      <button className="btn full spaced" onClick={onReview} type="button">
        Review game
      </button>
      <button
        className={`btn full spaced${onRematch ? "" : " primary"}`}
        onClick={onNew}
        type="button"
      >
        New game
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
        {game.hist.some((entry) => entry.ann === null) && (
          <p className="note">Review incomplete: some moves do not yet have comparable analysis.</p>
        )}
        {!items.length && (
          <div className="item">
            {reviewing
              ? "Working through the moves…"
              : game.hist.some((entry) => entry.ann === null)
                ? "No verdict yet for the remaining moves. Run review again to reanalyse."
                : "No turning points found by this reviewer."}
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

export function setupFromDraft(draft: SetupDraft, betaEnabled = false): Setup {
  if (draft.opponentId === "attack-development" && !betaEnabled)
    throw new Error("New personality games are disabled in this build.");
  if (
    draft.opponentId === "attack-development" &&
    draft.opponentVersion !== undefined &&
    ![1, 2, 3].includes(draft.opponentVersion)
  )
    throw new Error("Opponent version is unavailable.");
  return {
    playerColor: draft.color === "rand" ? (Math.random() < 0.5 ? "w" : "b") : draft.color,
    level: draft.level,
    time: draft.time,
    ...(draft.opponentId === "attack-development"
      ? {
          opponent: (draft.opponentVersion === 1
            ? morphyConfig
            : draft.opponentVersion === 2
              ? ratedMorphyConfig
              : historicalMorphyConfig)(crypto.getRandomValues(new Uint32Array(1))[0]),
        }
      : {}),
  };
}

export function ForfeitModal({
  game,
  rating,
  onResume,
  onForfeit,
}: {
  game: Game;
  rating: Rating;
  onResume(): void;
  onForfeit(): void;
}) {
  const opponent = opponentPracticeRating(game.opponent, game.setup.level);
  const before = Math.round(rating.rating);
  const after =
    game.rated && opponent !== null
      ? Math.round(ratingUpdate(rating, opponent, 0, { opp: "" }, game.clockAt).next.rating)
      : before;
  return (
    <Modal title="Finish your current game?" onClose={onResume} closeOnBackdrop={false}>
      <p>
        You have an unfinished game against {opponentName(game.opponent)}. Resume it, or forfeit
        before choosing another game.
      </p>
      <p role="status">
        {!game.rated
          ? "No rating change. This game is already unrated."
          : before === FIDE_FLOOR
            ? `Your rating stays at ${FIDE_FLOOR} (the minimum), but this counts as a rated loss.`
            : `This counts as a rated loss. Practice Rating: ${before} → ${after} (${before - after} points lost).`}
      </p>
      {game.clocks && <p>Your clock keeps running while you decide.</p>}
      <div className="optrow">
        <button className="btn primary" onClick={onResume}>
          Resume game
        </button>
        <button className="btn" onClick={onForfeit}>
          Forfeit and continue
        </button>
      </div>
    </Modal>
  );
}
