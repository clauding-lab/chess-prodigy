import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AccountUser } from "../account/types";
import type { Move } from "../engine/types";
import { inCheck, kingSq, legalMoves } from "../engine/board";
import { Board } from "../ui/Board";
import { Modal } from "../ui/Modal";
import { PromotionModal } from "../ui/Modals";
import { activateSound, playSound, silenceSound } from "../game/sound";
import { actOnGame, createInvite, joinInvite, listGames, readGame } from "./api";
import type { MultiplayerGame, MultiplayerList, InviteColor, HeadToHead } from "./types";
import { CompletedReview } from "./Review";
import { NotificationSettings } from "./NotificationSettings";
import { UpdatePrompt } from "../ui/UpdatePrompt";
import { Brand } from "../ui/Brand";
import { Chat } from "./Chat";

function h2h(name: string, score: HeadToHead) {
  return `${name} ${score.wins}–${score.losses} ${score.opponent.name} · ${score.draws} draw${score.draws === 1 ? "" : "s"}`;
}
export function Multiplayer({
  user,
  path,
  navigate,
  controls,
  onSignIn,
  onCompletedGame,
}: {
  user: AccountUser | null;
  path: string;
  navigate(path: string): void;
  controls: ReactNode;
  onSignIn(): void;
  onCompletedGame?(): void;
}) {
  const [list, setList] = useState<MultiplayerList | null>(null);
  const [game, setGame] = useState<MultiplayerGame | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [color, setColor] = useState<InviteColor>("random");
  const [invite, setInvite] = useState("");
  const [inviteGameId, setInviteGameId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null);
  const [confirm, setConfirm] = useState<"resign" | "cancel" | null>(null);
  const [sound, setSound] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [theme, setTheme] = useState<"dark" | "wood">("dark");
  const [chatAlertTarget, setChatAlertTarget] = useState<HTMLDivElement | null>(null);
  const generation = useRef(0);
  const actionPending = useRef(false);
  const latestGame = useRef<MultiplayerGame | null>(null);
  const soundEnabled = useRef(sound);
  soundEnabled.current = sound;
  const id = path.startsWith("/game/") ? path.slice(6) : null;
  const token = path.startsWith("/invite/") ? path.slice(8) : null;
  const userId = user?.id;
  useEffect(() => {
    if (game?.status === "completed") onCompletedGame?.();
  }, [game?.id, game?.status, onCompletedGame]);
  const completedGames = list?.rating.games ?? 0;
  useEffect(() => {
    if (completedGames > 0) onCompletedGame?.();
  }, [completedGames, onCompletedGame]);
  const scope = `${userId}:${path}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => {
    const version = ++generation.current;
    setGame(null);
    latestGame.current = null;
    setList(null);
    setError("");
    setConnected(false);
    setSelected(null);
    setPromotion(null);
    setConfirm(null);
    setBusy(false);
    actionPending.current = false;
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout>;
    let requestRunning = false;
    const update = async () => {
      if (version !== generation.current || requestRunning) return;
      if (actionPending.current) {
        timer = setTimeout(() => void update(), 3000);
        return;
      }
      requestRunning = true;
      try {
        if (token) {
          const next = await joinInvite(userId, token);
          if (version !== generation.current) return;
          if (next.status === "waiting") {
            setInvite(`${location.origin}/invite/${token}`);
            setInviteGameId(next.id);
          }
          navigate(`/game/${next.id}`);
          return;
        }
        if (id) {
          const next = await readGame(userId, id);
          if (version !== generation.current || actionPending.current) return;
          acceptGame(next);
        } else {
          const next = await listGames(userId);
          if (version !== generation.current || actionPending.current) return;
          setList(next);
        }
        setError("");
        setConnected(true);
      } catch (reason) {
        if (version === generation.current) {
          setError(reason instanceof Error ? reason.message : "Connection lost. Retrying…");
          setConnected(false);
        }
      } finally {
        requestRunning = false;
        if (version === generation.current) timer = setTimeout(() => void update(), 3000);
      }
    };
    void update();
    const refresh = () => {
      clearTimeout(timer);
      void update();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      generation.current = version + 1;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      silenceSound();
    };
    // navigate is a stable callback from the shell; a route transition cancels all old requests.
  }, [userId, id, token, navigate]);

  function acceptGame(next: MultiplayerGame) {
    const previous = latestGame.current;
    if (previous && next.revision < previous.revision) return;
    if (previous && next.moves.length === previous.moves.length + 1)
      playSound(
        next.result ? "end" : next.moves.at(-1)?.move.capture ? "capture" : "move",
        soundEnabled.current,
      );
    else if (previous && !previous.result && next.result) playSound("end", soundEnabled.current);
    if (!previous) setFlipped(next.yourColor === "b");
    latestGame.current = next;
    setGame(next);
    if (!previous || next.revision !== previous.revision) {
      setSelected(null);
      setPromotion(null);
      setConfirm(null);
    }
  }
  async function run(work: () => Promise<void>) {
    if (actionPending.current) return;
    const capturedScope = currentScope.current;
    actionPending.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (reason) {
      if (capturedScope === currentScope.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The action could not be completed. Refresh and retry.",
        );
        setConnected(false);
      }
    } finally {
      if (capturedScope === currentScope.current) {
        actionPending.current = false;
        setBusy(false);
      }
    }
  }
  function act(
    action: "move" | "resign" | "draw" | "cancel",
    detail: Parameters<typeof actOnGame>[3] = {},
  ) {
    if (!user || !game) return;
    const capturedScope = scope;
    void run(async () => {
      const next = await actOnGame(user.id, game, action, detail);
      if (currentScope.current !== capturedScope) return;
      acceptGame(next);
      setConnected(true);
    });
  }
  const canMove =
    !!game &&
    game.status === "active" &&
    game.position.turn === game.yourColor &&
    connected &&
    !busy;
  const moves = game && canMove ? legalMoves(game.position) : [];
  const targets = selected === null ? [] : moves.filter((move) => move.from === selected);
  function square(sq: number) {
    if (!canMove || !game) return;
    const candidates = targets.filter((move) => move.to === sq);
    if (candidates.length > 1) {
      setPromotion(candidates);
      return;
    }
    if (candidates.length === 1) {
      act("move", { move: candidates[0] });
      return;
    }
    setSelected(sq !== selected && game.position.board[sq]?.[0] === game.yourColor ? sq : null);
  }
  return (
    <div
      className="app multiplayer"
      data-theme={theme}
      onClickCapture={() => {
        if (sound) void activateSound();
      }}
      onKeyDownCapture={() => {
        if (sound) void activateSound();
      }}
    >
      <Brand />
      {controls}
      <div className="chat-shortcut" ref={setChatAlertTarget} />
      <nav className="controls" aria-label="Game modes">
        <button className="btn" onClick={() => navigate("/")}>
          Computer practice
        </button>
        <button className="btn" onClick={() => navigate("/games")}>
          My games
        </button>
      </nav>
      <UpdatePrompt
        offlineMessage="Computer practice is ready offline. Friend games need an internet connection."
        active={busy || game?.status === "active"}
        save={() => !actionPending.current}
      />
      <h1>{game ? "Play a friend" : token ? "You’re invited to play" : "My games"}</h1>
      {!user ? (
        <section className="panel mp-intro">
          <p>Register or sign in to play a friend. Your invitation will be waiting here.</p>
          <p>
            You’ll receive game-start and overdue-turn emails. Push alerts are optional, and
            notifications can be changed in My games.
          </p>
          <button className="btn primary" onClick={onSignIn}>
            Sign in or register
          </button>
        </section>
      ) : (
        <>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {!game && !list && !error && (
            <p role="status">{token ? "Joining your game…" : "Loading games…"}</p>
          )}
          {list && (
            <div className="mp-lobby">
              <section className="panel">
                <h2>Play a friend</h2>
                <p>Untimed chess. Come back whenever you’re ready.</p>
                <label>
                  Your colour{" "}
                  <select value={color} onChange={(e) => setColor(e.target.value as InviteColor)}>
                    <option value="random">Random</option>
                    <option value="w">White</option>
                    <option value="b">Black</option>
                  </select>
                </label>
                <p className="quiet">
                  We’ll email you when your opponent joins and once if your turn waits more than 10
                  minutes. You can change notifications below.
                </p>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => {
                    const capturedScope = scope;
                    void run(async () => {
                      const next = await createInvite(user.id, color);
                      if (currentScope.current !== capturedScope) return;
                      setInvite(`${location.origin}/invite/${next.token}`);
                      setInviteGameId(next.id);
                      navigate(`/game/${next.id}`);
                    });
                  }}
                >
                  Create invitation
                </button>
              </section>
              <section className="panel">
                <h2>1v1 Rating · {Math.round(list.rating.rating)}</h2>
                <p>
                  {list.rating.games < 10 ? "Provisional · " : ""}
                  {list.rating.games} completed games
                </p>
                <h2>Your matches</h2>
                {list.games.length === 0 ? (
                  <p>No matches yet. Invite a friend to begin.</p>
                ) : (
                  <ul className="mp-matches">
                    {list.games.map((match) => (
                      <li key={match.id}>
                        <button className="linkbtn" onClick={() => navigate(`/game/${match.id}`)}>
                          {match.white?.name ?? "Waiting"} vs {match.black?.name ?? "Waiting"}
                        </button>
                        <span>
                          {match.result?.result ??
                            (match.status === "active"
                              ? match.position.turn === match.yourColor
                                ? "Your turn"
                                : "Their turn"
                              : match.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {list.opponents.length > 0 && (
                  <>
                    <h2>Head to head</h2>
                    {list.opponents.map((score) => (
                      <p key={score.opponent.id}>{h2h(user.name, score)}</p>
                    ))}
                  </>
                )}
              </section>
              <NotificationSettings userId={user.id} />
            </div>
          )}
          {game && (
            <>
              {game.status === "waiting" ? (
                <section className="panel mp-intro">
                  <h2>Waiting for your opponent</h2>
                  {invite && inviteGameId === game.id ? (
                    <>
                      <label>
                        Invitation link
                        <input readOnly value={invite} onFocus={(e) => e.currentTarget.select()} />
                      </label>
                      <button
                        className="btn"
                        onClick={() =>
                          void navigator.clipboard
                            ?.writeText(invite)
                            .catch(() => setError("Select and copy the invitation link above."))
                        }
                      >
                        Copy invitation
                      </button>
                    </>
                  ) : (
                    <p>
                      Use the link you copied when creating this invitation, or cancel and create a
                      new one.
                    </p>
                  )}
                  <p>
                    One opponent can join. The link expires after seven days. You can close this
                    page; we’ll notify you when they join.
                  </p>
                  <button className="btn" disabled={busy} onClick={() => setConfirm("cancel")}>
                    Cancel invitation
                  </button>
                </section>
              ) : game.status === "expired" || game.status === "cancelled" ? (
                <p>This invitation is {game.status}. Create another from My games.</p>
              ) : (
                <main className="stage">
                  <section className="play">
                    <div className="mp-score" role="group" aria-label="Head to head">
                      {game.headToHead &&
                        h2h(
                          game.white?.name ?? user.name,
                          game.yourColor === "w"
                            ? game.headToHead
                            : {
                                ...game.headToHead,
                                wins: game.headToHead.losses,
                                losses: game.headToHead.wins,
                                opponent: game.black!,
                              },
                        )}
                    </div>
                    <div className="playerbar">
                      {(flipped ? game.white : game.black)?.name} · 1v1{" "}
                      {Math.round((flipped ? game.white : game.black)?.rating ?? 1200)}
                    </div>
                    <div className="boardwrap">
                      <Board
                        key={game.id}
                        board={game.position.board}
                        flipped={flipped}
                        selected={selected}
                        targets={targets}
                        lastMove={game.moves.at(-1)?.move ?? null}
                        hint={null}
                        checkedKing={
                          inCheck(game.position, game.position.turn)
                            ? kingSq(game.position.board, game.position.turn)
                            : null
                        }
                        onSquare={square}
                        onEscape={() => setSelected(null)}
                        disabled={!canMove}
                        ply={game.moves.length}
                      />
                    </div>
                    <div className="playerbar">
                      {(flipped ? game.black : game.white)?.name} · 1v1{" "}
                      {Math.round((flipped ? game.black : game.white)?.rating ?? 1200)}
                    </div>
                    <p role="status">
                      {game.result
                        ? `${game.result.result} · ${game.result.reason}`
                        : !connected
                          ? "Reconnecting… Moves are paused."
                          : canMove
                            ? "Your turn"
                            : busy
                              ? "Saving move…"
                              : "Waiting for your opponent"}
                    </p>
                    {game.ratingChanges && (
                      <p>
                        1v1 rating changes: {game.white?.name}{" "}
                        {game.ratingChanges.white >= 0 ? "+" : ""}
                        {game.ratingChanges.white.toFixed(1)} · {game.black?.name}{" "}
                        {game.ratingChanges.black >= 0 ? "+" : ""}
                        {game.ratingChanges.black.toFixed(1)}
                      </p>
                    )}
                    <div className="controls">
                      <button className="btn" onClick={() => setFlipped(!flipped)}>
                        Flip
                      </button>
                      <button
                        className="btn"
                        onClick={() => setTheme(theme === "dark" ? "wood" : "dark")}
                      >
                        {theme === "dark" ? "Wooden board" : "Dark board"}
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          setSound(!sound);
                          if (sound) silenceSound();
                          else {
                            const activationVersion = generation.current;
                            void activateSound().then((ready) => {
                              if (!soundEnabled.current || generation.current !== activationVersion)
                                return;
                              if (ready) playSound("move", true);
                              else
                                setError(
                                  "Audio could not start. Check device volume and try again.",
                                );
                            });
                          }
                        }}
                      >
                        {sound ? "Sound on" : "Sound off"}
                      </button>
                      {game.status === "active" && (
                        <>
                          <button
                            className="btn"
                            disabled={busy || !connected}
                            onClick={() => setConfirm("resign")}
                          >
                            Resign
                          </button>
                          {!game.drawOfferBy && (
                            <button
                              className="btn"
                              disabled={busy || !connected}
                              onClick={() => act("draw", { action: "offer" })}
                            >
                              Offer draw
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {game.drawOfferBy && game.status === "active" && (
                      <div className="notice">
                        {game.drawOfferBy === user.id ? (
                          "Draw offered. Waiting for your opponent."
                        ) : (
                          <>
                            Your opponent offers a draw.{" "}
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => act("draw", { action: "accept" })}
                            >
                              Accept draw
                            </button>
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => act("draw", { action: "decline" })}
                            >
                              Decline draw
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="movelist" role="group" aria-label="Move history">
                      {game.moves.map((entry, index) => (
                        <span key={index}>
                          {index % 2 === 0 ? `${index / 2 + 1}. ` : ""}
                          {entry.san}{" "}
                        </span>
                      ))}
                    </div>
                  </section>
                  <Chat
                    key={`${user.id}:${game.id}`}
                    userId={user.id}
                    gameId={game.id}
                    alertTarget={chatAlertTarget}
                  />
                  {game.review ? (
                    <CompletedReview game={game.review} color={game.yourColor ?? "w"} />
                  ) : (
                    <aside className="panel mp-coach-note">
                      <h2>A game between friends</h2>
                      <p>Play at your own pace. Your game is saved after every move.</p>
                      <p>Coaching and review unlock when the game ends.</p>
                      <p>No clock. One reminder after 10 minutes waiting on your turn.</p>
                      <p>
                        Game-start and overdue-turn emails are enabled unless you turn them off.
                        Change email and device alerts in My games.
                      </p>
                    </aside>
                  )}
                </main>
              )}
            </>
          )}
          {promotion && game && (
            <PromotionModal
              moves={promotion}
              color={game.yourColor ?? "w"}
              onPick={(move) => {
                setPromotion(null);
                act("move", { move });
              }}
            />
          )}
          {confirm && (
            <Modal
              title={confirm === "resign" ? "Resign this game?" : "Cancel invitation?"}
              onClose={() => setConfirm(null)}
            >
              <p>
                {confirm === "resign"
                  ? "This counts as a loss for your 1v1 rating and head-to-head score."
                  : "The invitation link will stop accepting players."}
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  act(confirm);
                  setConfirm(null);
                }}
              >
                {confirm === "resign" ? "Resign" : "Cancel invitation"}
              </button>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
