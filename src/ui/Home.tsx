import type { Game, Preferences } from "../game/types";
import type { Rating } from "../rating/fide";
import { LEVEL_LABEL } from "../rating/fide";
import { opponentName, isSupportedOpponent } from "../engine/opponents";
import { GLYPH } from "./Board";
import { CHIGORIN_RATINGS, PLANNED_MORPHY_RATINGS } from "../rating/opponents";
import type { SetupDraft } from "./Modals";
import "./home.css";

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export function Home({
  game,
  rating,
  preferences,
  betaEnabled,
  canResume,
  onPlay,
  onResume,
  onResult,
  onGames,
  onTheme,
}: {
  game: Game;
  rating: Rating;
  preferences: Preferences;
  betaEnabled: boolean;
  canResume: boolean;
  onPlay(opponent?: SetupDraft["opponentId"]): void;
  onResume(): void;
  onResult(): void;
  onGames(): void;
  onTheme(): void;
}) {
  const available = isSupportedOpponent(game.opponent);
  const active = canResume && !game.over;
  const board = preferences.flipped ? game.st.board.slice().reverse() : game.st.board;
  return (
    <main className="home" aria-label="Chess Prodigy home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-welcome">
          <h1 id="home-title">Chess with character.</h1>
          <p className="home-intro">
            Play a good game. Understand your moves. Come back a stronger player.
          </p>
          <div className="home-current">
            {active ? (
              <>
                <h2>Your game is waiting</h2>
                <p>
                  {opponentName(game.opponent)} · {LEVEL_LABEL[game.setup.level]} · You play{" "}
                  {game.setup.playerColor === "w" ? "White" : "Black"}
                </p>
                {game.opponent.id === "attack-development" &&
                  [1, 2, 3].includes(game.opponent.version) && (
                    <p className="home-caption">
                      This saved game keeps the earlier opponent. New Morphy games use his recorded
                      openings and designed plans.
                    </p>
                  )}
                {game.clocks ? (
                  <>
                    <div className="home-clocks" aria-label="Game clocks">
                      <span>
                        You <strong>{clock(game.clocks[game.setup.playerColor])}</strong>
                      </span>
                      <span>
                        Opponent{" "}
                        <strong>
                          {clock(game.clocks[game.setup.playerColor === "w" ? "b" : "w"])}
                        </strong>
                      </span>
                    </div>
                    <p className="home-caption">
                      The clock keeps running here and when you close the app.
                    </p>
                  </>
                ) : (
                  <p className="home-caption">No clock. Pick up where you left off.</p>
                )}
              </>
            ) : game.over ? (
              <>
                <h2>Your last game</h2>
                <p>
                  {opponentName(game.opponent)} · {game.over.reason} · {game.over.result}
                </p>
              </>
            ) : (
              <p className="home-caption">
                Play as a guest, or sign in to keep your progress across devices.
              </p>
            )}
            <div className="home-actions">
              {active && available && (
                <button className="btn primary" onClick={onResume}>
                  Resume game
                </button>
              )}
              {game.over && available && (
                <button className="btn primary" onClick={onResult}>
                  View result
                </button>
              )}
              {!available && (
                <button className="btn primary" onClick={onResume}>
                  View saved game
                </button>
              )}
              <button
                className={`btn${!active && !game.over ? " primary" : ""}`}
                disabled={!available}
                onClick={() => onPlay()}
              >
                New game
              </button>
            </div>
          </div>
        </div>
        <figure className="home-position">
          <div
            className="home-mini-board"
            role="img"
            aria-label={
              game.started
                ? "Preview of your saved chess position"
                : "Chessboard ready for a new game"
            }
          >
            {board.map((piece, i) => (
              <span
                key={i}
                className={`home-square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark" : "light"}`}
              >
                {piece && (
                  <span aria-hidden="true" className={`home-piece ${piece[0]}`}>
                    {GLYPH[piece[1] as keyof typeof GLYPH]}
                  </span>
                )}
              </span>
            ))}
          </div>
          <figcaption>
            {game.started
              ? `${game.hist.length} moves played${game.over ? " · Game complete" : " · Position saved"}`
              : "Every game has something to teach you."}
          </figcaption>
        </figure>
      </section>
      <section className="home-opponents" aria-labelledby="opponents-title">
        <div className="home-section-intro">
          <h2 id="opponents-title">Who will you play?</h2>
          <p>Choose a playing style, then a difficulty. The rules of chess stay the same.</p>
        </div>
        <div className={`home-roster${betaEnabled ? " home-roster-personalities" : ""}`}>
          <article className="home-opponent">
            <div className="home-opponent-title">
              <span aria-hidden="true" className="home-emblem">
                ♜
              </span>
              <div>
                <h3>Classic</h3>
                <p>Standard computer</p>
              </div>
            </div>
            <p>
              Chess Prodigy’s original computer opponent. A straightforward place to practise
              openings, spot threats and work on your game.
            </p>
            <p className="home-caption">Start here if you’re getting to know the app.</p>
            <button className="btn" disabled={!available} onClick={() => onPlay("classic")}>
              Play Classic
            </button>
          </article>
          {betaEnabled && (
            <article className="home-opponent home-morphy">
              <div className="home-opponent-title">
                <span aria-hidden="true" className="home-emblem">
                  ♞
                </span>
                <div>
                  <h3>Paul Morphy</h3>
                  <p>Attack &amp; development</p>
                </div>
              </div>
              <p>
                Paul Morphy was an American chess master of the 1800s. This simulation uses recorded
                openings plus designed development, central-break and king-attack plans inspired by
                his games.
              </p>
              <details>
                <summary>Who was Paul Morphy?</summary>
                <p>
                  An American chess master of the 1800s, Morphy became famous for brilliant
                  attacking games. His documented games inspire these designed priorities; this is
                  not a perfect recreation of the person or a measure of his human playing strength.
                </p>
                <a
                  href="https://timkr.home.xs4all.nl/ChessTutor/morphy.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore the Morphy game collection{" "}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </details>
              <button
                className="btn"
                disabled={!available}
                onClick={() => onPlay("attack-development")}
              >
                Play Paul Morphy
              </button>
            </article>
          )}
          {betaEnabled && (
            <article className="home-opponent home-chigorin">
              <div className="home-opponent-title">
                <span aria-hidden="true" className="home-emblem">
                  ♞
                </span>
                <div>
                  <h3>Mikhail Chigorin</h3>
                  <p>Knights &amp; central counterplay</p>
                </div>
              </div>
              <p>
                Play against recorded openings plus designed priorities for active knights, central
                counterplay and coordinated attacks, inspired by Chigorin’s games.
              </p>
              <details>
                <summary>Who was Mikhail Chigorin?</summary>
                <p>
                  A leading Russian master of the late 1800s, Chigorin is remembered for inventive
                  knight play and fighting attacks. These designed priorities are a simulation, not
                  a perfect recreation of the person or a measure of his human playing strength.
                </p>
                <a
                  href="https://www.chess.com/article/view/the-chigorin-queens-gambit-a-history-part-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Explore Chigorin’s playing ideas{" "}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </details>
              {!CHIGORIN_RATINGS && (
                <p className="home-caption">Strength measurement in progress.</p>
              )}
              <button
                className="btn"
                disabled={!available || !CHIGORIN_RATINGS}
                onClick={() => onPlay("chigorin")}
              >
                Play Mikhail Chigorin
              </button>
            </article>
          )}
        </div>
        <p className="home-rating-note">
          {betaEnabled ? "Choose from" : "Classic offers"} Casual, Club and Strong.{" "}
          {betaEnabled &&
            `Morphy’s measured strengths are ${PLANNED_MORPHY_RATINGS.casual}, ${PLANNED_MORPHY_RATINGS.club} and ${PLANNED_MORPHY_RATINGS.strong}. `}
          {betaEnabled &&
            CHIGORIN_RATINGS &&
            `Chigorin’s measured strengths are ${CHIGORIN_RATINGS.casual}, ${CHIGORIN_RATINGS.club} and ${CHIGORIN_RATINGS.strong}. `}
          Practice Ratings measure progress within this app. Hints and takebacks make a game
          unrated.
        </p>
      </section>
      <section className="home-progress" aria-label="Your practice progress">
        <div>
          <strong>{Math.round(rating.rating)}</strong>
          <span>Practice Rating</span>
          <small>
            {rating.games} rated {rating.games === 1 ? "game" : "games"}
          </small>
        </div>
        <p>Revisit your games, replay a turning point, or try the same opponent again.</p>
        <button className="btn" onClick={onGames}>
          Games
        </button>
      </section>
      <footer className="home-footer">
        <span>Learn while you play. Coaching is always optional.</span>
        <button className="linkbtn" onClick={onTheme}>
          {preferences.theme === "wood" ? "Dark board" : "Wooden board"}
        </button>
      </footer>
    </main>
  );
}
