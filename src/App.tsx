import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Home } from "./ui/Home";
import { Brand } from "./ui/Brand";
import { inCheck, kingSq, legalMoves, toFEN } from "./engine/board";
import type { Color, Move } from "./engine/types";
import { VAL } from "./engine/eval";
import { useGame, type GameStorageAdapter } from "./game/useGame";
import { ENGINE_ELO, LEVEL_LABEL } from "./rating/fide";
import { Board, GLYPH } from "./ui/Board";
import { CoachPanel } from "./ui/CoachPanel";
import {
  ConfirmModal,
  ForfeitModal,
  PromotionModal,
  ResultModal,
  ReviewModal,
  SetupModal,
  setupFromDraft,
  type Confirmation,
  type SetupDraft,
} from "./ui/Modals";
import { RatingPanel } from "./ui/RatingPanel";
import { UpdatePrompt } from "./ui/UpdatePrompt";
import { activateSound, playSound, silenceSound } from "./game/sound";
import "./ui/theme.css";
import { isSupportedOpponent, opponentName, personalityBetaEnabled } from "./engine/opponents";
import { unratedDescription } from "./game/eligibility";
import type { GameRecord } from "./account/types";
import { canRematch, RecordedGamesModal } from "./ui/RecordedGames";

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
const order = ["q", "r", "b", "n", "p"];

export default function App({
  storage,
  accountControls,
  accountNotice,
  suspended = false,
}: {
  storage?: GameStorageAdapter;
  accountControls?: ReactNode;
  accountNotice?: ReactNode;
  suspended?: boolean;
} = {}) {
  const [home, setHome] = useState(true);
  const [hasChosenGame, setHasChosenGame] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [forfeitPending, setForfeitPending] = useState(false);
  const gameApi = useGame(!suspended && showSetup, storage, suspended || home);
  const { game, rating, preferences } = gameApi;
  const available = isSupportedOpponent(game.opponent);
  const betaEnabled = personalityBetaEnabled(import.meta.env.VITE_PERSONALITY_BETA);
  const draftOpponent =
    betaEnabled && game.opponent.id === "attack-development" ? "attack-development" : "classic";
  const soundReady = useRef(false);
  soundReady.current = preferences.sound && !suspended;
  useEffect(
    () => () => {
      soundReady.current = false;
      silenceSound();
    },
    [],
  );
  const [draft, setDraft] = useState<SetupDraft>({
    color: game.setup.playerColor,
    level: game.setup.level,
    time: game.setup.time,
    opponentId: draftOpponent,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [rematchNote, setRematchNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [dismissedResult, setDismissedResult] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fenFallback, setFenFallback] = useState<string | null>(null);
  const [recoveryExported, setRecoveryExported] = useState(false);

  useEffect(() => {
    if (game.over) {
      setForfeitPending(false);
      setPromotion(null);
      setSelected(null);
      setConfirm(null);
    }
  }, [game.over]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);
  const moves = useMemo(() => legalMoves(game.st), [game.st]);
  const targets = selected === null ? [] : moves.filter((m) => m.from === selected);
  const playerColor = game.setup.playerColor,
    aiColor: Color = playerColor === "w" ? "b" : "w";
  const checkedKing = inCheck(game.st, game.st.turn) ? kingSq(game.st.board, game.st.turn) : null;
  const lastMove = game.hist.at(-1)?.mv ?? null;

  function onSquare(square: number) {
    if (!available || game.over || gameApi.thinking || game.st.turn !== playerColor) return;
    if (selected === null) {
      if (game.st.board[square]?.[0] === playerColor) setSelected(square);
      return;
    }
    if (square === selected) {
      setSelected(null);
      return;
    }
    const candidates = targets.filter((m) => m.to === square);
    if (candidates.length > 1 && candidates.some((m) => m.promo)) {
      setPromotion(candidates);
      return;
    }
    if (candidates[0]) {
      gameApi.move(candidates[0]);
      setSelected(null);
      return;
    }
    setSelected(game.st.board[square]?.[0] === playerColor ? square : null);
  }
  function requestSetup() {
    if (game.started && !game.over) setForfeitPending(true);
    else setShowSetup(true);
  }
  function resume() {
    gameApi.refreshClock();
    setForfeitPending(false);
    setHome(false);
  }
  function openSetup(opponentId?: "classic" | "attack-development") {
    setStartError(null);
    setRematchNote(null);
    setDraft({
      color: playerColor,
      level: game.setup.level,
      time: game.setup.time,
      opponentId: opponentId ?? draftOpponent,
    });
    requestSetup();
  }
  function start() {
    if (!gameApi.startGame(setupFromDraft(draft, betaEnabled))) {
      setStartError(
        "The previous game could not be saved. Download a recovery save, then cancel and check Games or retry saving before starting another game.",
      );
      return;
    }
    setStartError(null);
    setHome(false);
    setHasChosenGame(true);
    setSelected(null);
    setPromotion(null);
    setShowSetup(false);
    setShowReview(false);
  }
  function rematch(record: Pick<GameRecord, "opponent" | "level" | "playerColor" | "time">) {
    if (!canRematch(record, betaEnabled)) return;
    setDraft({
      color: record.playerColor,
      level: record.level,
      time: record.time ?? "none",
      opponentId: record.opponent.id === "attack-development" ? "attack-development" : "classic",
      opponentVersion: record.opponent.version,
    });
    setRematchNote(
      [
        record.time === undefined
          ? "Original clock setting was not recorded; choose a time control."
          : null,
        record.opponent.id === "attack-development" && [1, 2].includes(record.opponent.version)
          ? "This rematch keeps the earlier opponent. New Morphy games use his documented repertoire; select Paul Morphy above to switch."
          : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
    );
    setStartError(null);
    setShowGames(false);
    requestSetup();
  }
  function askHint() {
    if (game.rated && game.started)
      setConfirm({
        title: "Ask the coach?",
        body: "Hints make this game unrated. The rating only counts games you play unaided.",
        yes: "Show hint",
        onYes: () => {
          setConfirm(null);
          gameApi.askHint();
        },
      });
    else gameApi.askHint();
  }
  function review() {
    gameApi.review();
    setShowReview(true);
  }
  function closeReview() {
    gameApi.cancelReview();
    setShowReview(false);
  }
  function resign() {
    setConfirm({
      title: "Resign this game?",
      body: game.rated
        ? "It will be recorded as a loss and your rating adjusted."
        : "It will be recorded as an unrated loss. Your Practice Rating stays unchanged.",
      yes: "Resign",
      onYes: () => {
        setConfirm(null);
        gameApi.resign();
      },
    });
  }
  function resetRating() {
    setConfirm({
      title: "Reset your rating?",
      body: "Rating, game count and history all return to the starting point. This cannot be undone.",
      yes: "Reset",
      onYes: () => {
        setConfirm(null);
        gameApi.resetRating();
      },
    });
  }
  async function copyFen() {
    const fen = toFEN(game.st);
    try {
      await navigator.clipboard.writeText(fen);
      setToast("FEN copied");
    } catch {
      setFenFallback(fen);
      setToast("Select and copy the FEN below");
    }
  }
  function downloadRecovery() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(gameApi.recoverySession, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chess-prodigy-recovery.json";
    link.click();
    setRecoveryExported(true);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const captured = useMemo(() => {
    const w: string[] = [],
      b: string[] = [];
    for (const e of game.hist)
      if (e.mv.capture) (e.mv.capture[0] === "w" ? w : b).push(e.mv.capture[1]);
    const value = (a: string[]) => a.reduce((sum, t) => sum + (VAL[t as keyof typeof VAL] ?? 0), 0);
    return { byWhite: b, byBlack: w, adv: (value(b) - value(w)) / 100 };
  }, [game.hist]);
  function capStr(items: string[]) {
    return order
      .flatMap((t) => items.filter((x) => x === t))
      .map((t) => GLYPH[t as keyof typeof GLYPH])
      .join("");
  }
  function PlayerBar({ color }: { color: Color }) {
    const isTurn = !game.over && game.st.turn === color,
      caps = color === "w" ? captured.byWhite : captured.byBlack,
      adv = color === "w" ? captured.adv : -captured.adv,
      low = !!game.clocks && game.clocks[color] < 30000;
    const name =
      color === aiColor
        ? `${opponentName(game.opponent)} · ${LEVEL_LABEL[game.setup.level]}${game.opponent.id === "classic" ? ` (${ENGINE_ELO[game.setup.level]})` : ""}`
        : `You (${Math.round(rating.rating)})`;
    return (
      <div className="playerbar">
        <div>
          <div className="pname">
            <span aria-hidden="true" className={`turn-dot${isTurn ? " on" : ""}`} />
            {name}
            {color === aiColor && gameApi.thinking && (
              <span className="thinking quiet">thinking…</span>
            )}
          </div>
          <div className="caps">
            {capStr(caps)}
            {adv > 0 && <span className="adv">+{adv}</span>}
          </div>
        </div>
        {game.clocks && (
          <div className={`clock${low ? " low" : ""}`}>{fmtClock(game.clocks[color])}</div>
        )}
      </div>
    );
  }
  const top: Color = preferences.flipped ? "w" : "b",
    bottom: Color = preferences.flipped ? "b" : "w";
  const pairs = [];
  for (let i = 0; i < game.hist.length; i += 2) {
    const annotation = (entry: (typeof game.hist)[number]) =>
      entry.ann ? (
        <span
          className={`ann ${entry.ann === "book" ? "book" : entry.ann === "!" ? "good" : entry.ann === "?!" ? "dub" : "bad"}`}
        >
          {entry.ann === "book" ? "book" : entry.ann}
        </span>
      ) : null;
    pairs.push(
      <span className="mv" key={i}>
        <b>{Math.floor(i / 2) + 1}.</b>
        {game.hist[i].san}
        {annotation(game.hist[i])}
        {game.hist[i + 1] && (
          <>
            {" "}
            {game.hist[i + 1].san}
            {annotation(game.hist[i + 1])}
          </>
        )}
      </span>,
    );
  }
  const status = game.over
    ? `${game.over.reason} · ${game.over.result}`
    : checkedKing !== null
      ? "Check"
      : game.st.turn === playerColor
        ? "Your move"
        : "";
  const resultKey = game.over ? `${game.id}:${game.revision}` : null;
  if (suspended)
    return game.clocks && game.started && !game.over ? (
      <aside className="background-game-notice" role="status">
        Your timed computer game is still running. Return to Computer practice to make your move.
      </aside>
    ) : null;
  return (
    <div
      className={`app${home ? " app-home" : ""}`}
      data-theme={preferences.theme}
      onClickCapture={() => {
        if (preferences.sound) void activateSound();
      }}
      onKeyDownCapture={() => {
        if (preferences.sound) void activateSound();
      }}
    >
      <Brand />
      {accountControls}
      {home && (
        <Home
          game={game}
          rating={rating}
          canResume={gameApi.hasSavedGame || hasChosenGame || game.started}
          preferences={preferences}
          betaEnabled={betaEnabled}
          onPlay={openSetup}
          onResume={resume}
          onResult={() => {
            setDismissedResult(null);
            resume();
          }}
          onGames={() => {
            setShowGames(true);
            void gameApi.refreshHistory();
          }}
          onTheme={() =>
            gameApi.setPreferences({ theme: preferences.theme === "wood" ? "dark" : "wood" })
          }
        />
      )}
      <main className="stage" hidden={home}>
        <button
          className="linkbtn"
          onClick={() => {
            gameApi.refreshClock();
            gameApi.saveNow();
            setHome(true);
            setSelected(null);
            setPromotion(null);
          }}
          type="button"
        >
          Home
        </button>
        <PlayerBar color={top} />
        <div className="boardwrap">
          <Board
            key={game.id}
            ply={game.hist.length}
            board={game.st.board}
            checkedKing={checkedKing}
            disabled={!available || gameApi.thinking || !!game.over || game.st.turn !== playerColor}
            flipped={preferences.flipped}
            hint={gameApi.hint}
            lastMove={lastMove}
            onEscape={() => setSelected(null)}
            onSquare={onSquare}
            selected={selected}
            targets={targets}
          />
        </div>
        <PlayerBar color={bottom} />
        <div className="movelist">
          {pairs.length ? pairs : <span className="mv placeholder">Moves appear here</span>}
        </div>
        <div className="controls">
          <button
            className="btn primary"
            onClick={() => openSetup()}
            type="button"
            disabled={!available}
          >
            New game
          </button>
          <button
            className="btn"
            disabled={!available || gameApi.thinking || !game.hist.length}
            onClick={gameApi.undo}
            type="button"
          >
            Undo
          </button>
          <button
            className="btn"
            disabled={!available || !game.started || !!game.over || gameApi.thinking}
            onClick={resign}
            type="button"
          >
            Resign
          </button>
          <button
            className="btn"
            onClick={() => gameApi.setPreferences({ flipped: !preferences.flipped })}
            type="button"
          >
            Flip
          </button>
          <button className="btn" onClick={copyFen} type="button">
            Copy FEN
          </button>
          <button
            className="btn"
            onClick={() => {
              setShowGames(true);
              void gameApi.refreshHistory();
            }}
            type="button"
          >
            Games
          </button>
          <button
            className="btn"
            onClick={() =>
              gameApi.setPreferences({ theme: preferences.theme === "wood" ? "dark" : "wood" })
            }
            type="button"
          >
            {preferences.theme === "wood" ? "Dark board" : "Wooden board"}
          </button>
          <button
            className="btn"
            onClick={() => {
              const enabled = !preferences.sound;
              gameApi.setPreferences({ sound: enabled });
              if (!enabled) silenceSound();
              else
                void activateSound().then((ready) => {
                  if (!soundReady.current) return;
                  if (ready) playSound("move", true);
                  else
                    setToast(
                      "Audio could not start. Tap Sound off, then enable it again. Check device volume.",
                    );
                });
            }}
            type="button"
          >
            {preferences.sound ? "Sound on" : "Sound off"}
          </button>
        </div>
        {fenFallback && (
          <div className="fen-fallback">
            <label htmlFor="fen-copy">FEN position</label>
            <input
              id="fen-copy"
              onFocus={(e) => e.currentTarget.select()}
              readOnly
              value={fenFallback}
            />
          </div>
        )}
        <div aria-live="polite" className="status">
          {status}
          {!game.rated && <span className="quiet"> · {unratedDescription(game)}</span>}
        </div>
        <CoachPanel
          enabled={preferences.coach}
          game={game}
          hint={gameApi.hint}
          onHint={askHint}
          onReview={review}
          onToggle={() => gameApi.setPreferences({ coach: !preferences.coach })}
          playerColor={playerColor}
          reviewing={gameApi.reviewing}
          thinking={gameApi.thinking}
        />
        <RatingPanel
          onReset={resetRating}
          rating={rating}
          saved={gameApi.storageStatus === "saved"}
          resetDisabled={!available}
        />
      </main>
      <div className="shared-notices">
        {!available && (
          <div className="notice" role="alert">
            This saved opponent version is unavailable. The game is read-only and your progress is
            preserved. Use a compatible app version to continue. Download a recovery copy before
            applying an app update.{" "}
            <button className="linkbtn" onClick={downloadRecovery} type="button">
              Download recovery save
            </button>
          </div>
        )}
        {accountNotice && (
          <div className="notice" role="status">
            {accountNotice}
          </div>
        )}
        {gameApi.engineError && (
          <div className="notice" role="alert">
            The chess engine stopped responding.{" "}
            <button className="linkbtn" onClick={gameApi.retryEngine} type="button">
              Try the engine again
            </button>
          </div>
        )}
        {gameApi.storageStatus !== "saved" && (
          <div className="notice" role="alert">
            {gameApi.storageStatus === "corrupt"
              ? "The saved game could not be read. This game will stay in this tab until you choose to replace the damaged save."
              : "Saving is unavailable on this device."}{" "}
            <button
              className="linkbtn"
              onClick={() =>
                setConfirm({
                  title: "Enable saving?",
                  body: "This replaces the unreadable saved data with your current game and rating.",
                  yes: "Enable saving",
                  cancel: "Cancel",
                  onYes: () => {
                    gameApi.enableSaving();
                    setConfirm(null);
                  },
                })
              }
              type="button"
            >
              Enable saving
            </button>
          </div>
        )}
        {home && startError && (
          <p className="notice" role="alert">
            {startError}{" "}
            <button className="linkbtn" onClick={downloadRecovery}>
              Download recovery save
            </button>
          </p>
        )}
        <UpdatePrompt
          active={available && game.started && !game.over}
          save={available ? gameApi.saveNow : () => recoveryExported}
        />
      </div>
      {promotion && (
        <PromotionModal
          color={playerColor}
          moves={promotion}
          onPick={(m) => {
            gameApi.move(m);
            setPromotion(null);
            setSelected(null);
          }}
        />
      )}
      {!home &&
        available &&
        game.over &&
        showSetup === false &&
        !showReview &&
        !showGames &&
        dismissedResult !== resultKey && (
          <ResultModal
            game={game}
            history={gameApi.history}
            rematchAvailable={canRematch(game, betaEnabled)}
            onRematch={() =>
              rematch({
                opponent: game.opponent,
                level: game.setup.level,
                playerColor: game.setup.playerColor,
                time: game.setup.time,
              })
            }
            onDismiss={() => setDismissedResult(resultKey)}
            onNew={() => openSetup()}
            onReview={review}
            onUndo={gameApi.undo}
          />
        )}{" "}
      {showReview && (
        <ReviewModal game={game} onClose={closeReview} reviewing={gameApi.reviewing} />
      )}{" "}
      {showGames && (
        <RecordedGamesModal
          history={gameApi.history}
          target={{ opponent: game.opponent, level: game.setup.level }}
          scope={gameApi.historyScope}
          betaEnabled={betaEnabled}
          onRematch={rematch}
          onClose={() => setShowGames(false)}
          onRetry={() => {
            void gameApi.refreshHistory();
          }}
          loading={gameApi.historyLoading}
          error={gameApi.historyError}
        />
      )}
      {showSetup === true && (
        <SetupModal
          startError={startError}
          rematchNote={rematchNote}
          onRecovery={downloadRecovery}
          accountControls={accountControls}
          betaEnabled={betaEnabled}
          draft={draft}
          game={game}
          rating={rating}
          onCancel={() => setShowSetup(false)}
          onStart={start}
          setDraft={setDraft}
        />
      )}{" "}
      {forfeitPending && !game.over && (
        <ForfeitModal
          game={game}
          rating={rating}
          onResume={resume}
          onForfeit={() => {
            gameApi.forfeit();
            setForfeitPending(false);
            if (!gameApi.saveNow()) {
              setHome(true);
              setStartError(
                "Your result could not be saved. Keep this game and download a recovery copy before starting another.",
              );
              return;
            }
            setShowSetup(true);
          }}
        />
      )}
      {confirm && <ConfirmModal onCancel={() => setConfirm(null)} value={confirm} />}{" "}
      {toast && (
        <div aria-live="polite" className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
