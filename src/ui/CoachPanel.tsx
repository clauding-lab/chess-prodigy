import { useState } from "react";
import { bookLookup } from "../book/book";
import { MOTIFS } from "../coach/motifs";
import { MOTIF_STORIES, openingStory } from "../coach/stories";
import type { Color } from "../engine/types";
import type { Game } from "../game/types";
import { Card } from "./Card";
import { isNeutralEvaluation, reviewComplete, reviewHistory } from "../engine/reviewer";
import { isSupportedOpponent } from "../engine/opponents";

function fmtEval(score: number) {
  if (Math.abs(score) > 3000) return score > 0 ? "White mates" : "Black mates";
  const v = score / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}
const moveLabel = (k: number) => `${Math.floor(k / 2) + 1}${k % 2 === 0 ? "." : "..."}`;

export function CoachPanel({
  game,
  playerColor,
  enabled,
  thinking,
  reviewing,
  hint,
  onToggle,
  onHint,
  onReview,
}: {
  game: Game;
  playerColor: Color;
  enabled: boolean;
  thinking: boolean;
  reviewing: boolean;
  hint: { san: string; score: number } | null;
  onToggle(): void;
  onHint(): void;
  onReview(): void;
}) {
  const [cards, setCards] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, initial = false) => cards[`${game.id}:${key}`] ?? initial;
  const toggle = (key: string, initial = false) =>
    setCards((previous) => ({
      ...previous,
      [`${game.id}:${key}`]: !(previous[`${game.id}:${key}`] ?? initial),
    }));
  const ply = game.hist.length,
    book = bookLookup(game.hist.map((e) => e.san));
  const candidate = game.evals[ply];
  const current = isNeutralEvaluation(candidate, game.st, reviewHistory(game, ply))
    ? candidate
    : null;
  const pct = current
    ? 100 / (1 + Math.exp(-Math.max(-3000, Math.min(3000, current.score)) / 350))
    : 50;
  const last = ply ? game.hist[ply - 1] : null;
  const feed = game.hist.flatMap((entry, index) =>
    entry.motifs.map((m) => ({ ...m, ply: index + 1 })),
  );
  return (
    <section className="panel coach-panel" aria-labelledby="coach-title">
      <div className="coach-head">
        <span className="ttl" id="coach-title">
          COACH
        </span>
        <button
          aria-pressed={enabled}
          className={`switch${enabled ? " on" : ""}`}
          onClick={onToggle}
          type="button"
        >
          {enabled ? "Live" : "Off"}
          <span aria-hidden="true" className="track" />
        </button>
      </div>
      {enabled ? (
        <>
          <div
            className="evalbar"
            aria-label={`Position evaluation ${current ? fmtEval(current.score) : "pending"}`}
          >
            <div className="bar">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="val">{current ? fmtEval(current.score) : "…"}</div>
          </div>
          {current && !reviewComplete(current) && (
            <p className="note">Preliminary evaluation — review incomplete.</p>
          )}
          <div
            className="coach-reading"
            role="region"
            aria-label="Opening and coaching history"
            tabIndex={0}
          >
            <div className="opening">
              {book.info ? (
                <>
                  <div>
                    <span className="name">{book.info.name}</span>
                    <span className="eco">{book.info.eco}</span>
                  </div>
                  <div className="state">
                    {book.inBook
                      ? ply === 0
                        ? "Book position"
                        : "Still in book"
                      : `Left the book at move ${Math.ceil((book.leftAt ?? 0) / 2)}`}
                  </div>
                  <Card
                    title="About this opening"
                    kind="lineage"
                    origin={book.info.origin}
                    plan={book.info.plan}
                    story={openingStory(game.hist.map((e) => e.san))}
                    open={isOpen("opening", true)}
                    onToggle={() => toggle("opening", true)}
                  />
                </>
              ) : (
                <div className="state">
                  {ply === 0
                    ? "Play a move to see the opening."
                    : book.inBook
                      ? "In book, no named line yet."
                      : "Out of the book; no named opening matched."}
                </div>
              )}
            </div>
            {feed.length > 0 && (
              <>
                <h3 className="history-title">Moves & ideas</h3>
                <p className="history-note">
                  Your game’s stories stay here. Historical examples illustrate an idea; they do not
                  prove a move is best.
                </p>
              </>
            )}
            {feed.map((m, i) => {
              const card = MOTIFS[m.key],
                key = `${m.key}${m.ply}`;
              return (
                <Card
                  key={`${key}-${i}`}
                  title={`${moveLabel(m.ply - 1)} ${game.hist[m.ply - 1].san} · ${card.name}`}
                  kind={card.kind}
                  detail={m.detail}
                  origin={card.origin}
                  plan={card.plan}
                  story={MOTIF_STORIES[m.key]}
                  open={isOpen(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </div>
          {last?.better && last.before.turn === playerColor && (
            <div className="card static">
              <span className="ct">
                <span>Better was {last.better}</span>
                <span className="kind">engine</span>
              </span>
              <span className="detail">
                Your {last.san}
                {last.ann} lost ground; the engine preferred {last.better}.
              </span>
            </div>
          )}
          {hint && (
            <div className="card static">
              <span className="ct">
                <span>Hint: {hint.san}</span>
                <span className="kind">{fmtEval(hint.score)}</span>
              </span>
            </div>
          )}
          <div className="coach-row">
            <button
              className="btn"
              disabled={
                !isSupportedOpponent(game.opponent) ||
                !!game.over ||
                thinking ||
                game.st.turn !== playerColor ||
                !!hint
              }
              onClick={onHint}
              type="button"
            >
              Hint
            </button>
            <button
              className="btn"
              disabled={
                !isSupportedOpponent(game.opponent) || !game.started || reviewing || thinking
              }
              onClick={onReview}
              type="button"
            >
              {reviewing ? "Analysing…" : "Review game"}
            </button>
          </div>
        </>
      ) : (
        <div className="note no-margin">
          Coaching is off. Turn it on for the opening name and lineage, motif cards, the evaluation
          bar, hints and a post-game review.
        </div>
      )}
    </section>
  );
}
