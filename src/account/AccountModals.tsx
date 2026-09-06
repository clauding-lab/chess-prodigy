import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import {
  changeName,
  changePassword,
  getLeaderboard,
  getRecords,
  json,
  signIn,
  signUp,
} from "./api";
import { listGames } from "../multiplayer/api";
import type { AccountUser, GameRecord, LeaderboardPlayer } from "./types";

function ErrorMessage({ value }: { value: string }) {
  return value ? (
    <p className="form-error" role="alert">
      {value}
    </p>
  ) : null;
}

export function AuthModal({
  onAuthenticated,
  onClose,
}: {
  onAuthenticated: (user: AccountUser) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const user =
        mode === "signup"
          ? await signUp(
              String(data.get("name")),
              String(data.get("email")),
              String(data.get("password")),
            )
          : await signIn(String(data.get("email")), String(data.get("password")));
      if (!user) throw new Error("The account session could not be opened.");
      onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={mode === "signin" ? "Sign in" : "Create account"} onClose={onClose}>
      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label>
              Display name
              <input name="name" required maxLength={80} autoComplete="name" />
            </label>
            <p className="form-note">
              Your display name, FIDE Rating (unofficial computer practice), 1v1 Rating and game
              counts will be public on the leaderboards. Your email and games stay private.
            </p>
          </>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>
        {mode === "signup" && (
          <p className="form-note">Use 12–128 characters. Email recovery is not available yet.</p>
        )}
        <ErrorMessage value={error} />
        <div className="modal-actions">
          <button className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>
      </form>
      <button
        className="linkbtn"
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
      >
        {mode === "signin" ? "Create an account" : "I already have an account"}
      </button>
    </Modal>
  );
}

export function AccountModal({
  user,
  onClose,
  onSignOut,
  onNameChanged,
}: {
  user: AccountUser;
  onClose: () => void;
  onSignOut: () => Promise<void>;
  onNameChanged?: (name: string) => void;
}) {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [ratings, setRatings] = useState<{ practice: number; human: number; games: number } | null>(
    null,
  );
  useEffect(() => {
    void getRecords(user.id)
      .then(async (value) => {
        setGames(value.games);
        try {
          const multiplayer = await listGames(user.id);
          setRatings({
            practice: value.snapshot?.rating.rating ?? 1400,
            human: multiplayer.rating.rating,
            games: multiplayer.rating.games,
          });
        } catch {
          /* Private game records remain available if multiplayer is offline. */
        }
      })
      .catch((reason) => setError(reason.message));
  }, [user.id]);
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await changePassword(user.id, String(data.get("current")), String(data.get("next")));
      setPasswordOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password change failed.");
    }
  }
  return (
    <Modal title={user.name} onClose={onClose} className="account-modal">
      <p className="form-note">{user.email} · private</p>
      {ratings && (
        <div className="account-ratings">
          <p>
            FIDE Rating: <b>{Math.round(ratings.practice)}</b>
            <br />
            <span className="quiet">Unofficial · computer practice</span>
          </p>
          <p>
            1v1 Rating: <b>{Math.round(ratings.human)}</b>
            <br />
            <span className="quiet">
              {ratings.games < 10 ? "Provisional · " : ""}
              {ratings.games} game{ratings.games === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      )}
      <div className="account-actions">
        <button className="btn" onClick={() => setNameOpen(!nameOpen)}>
          Edit name
        </button>
        <button className="btn" onClick={() => setPasswordOpen(!passwordOpen)}>
          Change password
        </button>
        <button
          className="btn"
          onClick={() => void onSignOut().catch((reason) => setError(reason.message))}
        >
          Sign out
        </button>
      </div>
      {nameOpen && (
        <form
          className="account-form compact"
          onSubmit={async (event) => {
            event.preventDefault();
            const name = String(new FormData(event.currentTarget).get("name")).trim();
            setSavingName(true);
            setError("");
            try {
              await changeName(user.id, name);
              onNameChanged?.(name);
              setNameOpen(false);
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Name could not be saved.");
            } finally {
              setSavingName(false);
            }
          }}
        >
          <label>
            Display name
            <input name="name" defaultValue={user.name} minLength={1} maxLength={80} required />
          </label>
          <div className="controls">
            <button className="btn primary" disabled={savingName}>
              Save name
            </button>
            <button
              className="btn"
              type="button"
              disabled={savingName}
              onClick={() => setNameOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {passwordOpen && (
        <form className="account-form compact" onSubmit={password}>
          <label>
            Current password
            <input name="current" type="password" required autoComplete="current-password" />
          </label>
          <label>
            New password
            <input
              name="next"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="btn primary">Save password</button>
        </form>
      )}
      <ErrorMessage value={error} />
      <h4>Private game records</h4>
      {games === null && !error ? (
        <p className="quiet">Loading…</p>
      ) : games?.length === 0 ? (
        <p className="quiet">Completed games will appear here.</p>
      ) : (
        <ol className="record-list">
          {games?.map((game) => (
            <li key={game.id}>
              <b>{game.result}</b> · {game.reason} · {game.level}
              <span>{new Date(game.completedAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"practice" | "human">("practice");
  const [attempt, setAttempt] = useState(0);
  const [players, setPlayers] = useState<LeaderboardPlayer[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setPlayers(null);
    void (
      tab === "practice"
        ? getLeaderboard()
        : json<{ players: LeaderboardPlayer[] }>("/api/multiplayer/leaderboard").then(
            (result) => result.players,
          )
    )
      .then((value) => {
        if (active) setPlayers(value);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [tab, attempt]);
  return (
    <Modal title="Leaderboard" onClose={onClose} className="account-modal">
      <div className="controls" role="group" aria-label="Rating category">
        <button
          className="btn"
          aria-pressed={tab === "practice"}
          onClick={() => setTab("practice")}
        >
          FIDE Rating
        </button>
        <button className="btn" aria-pressed={tab === "human"} onClick={() => setTab("human")}>
          1v1 Rating
        </button>
      </div>
      <p className="form-note">
        {tab === "practice"
          ? "Unofficial · computer practice. This app does not issue official FIDE ratings or calibrated FIDE estimates."
          : "Community Elo from completed human matches. Provisional for your first 10 games."}
      </p>
      {players === null && !error && <p className="quiet">Loading…</p>}
      {error && (
        <>
          <ErrorMessage value={error} />
          <button className="btn" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </>
      )}
      {players?.length === 0 && <p className="quiet">No rated players yet.</p>}
      {!!players?.length && (
        <table className="leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={`${player.rank}:${player.name}`}>
                <td>{player.rank}</td>
                <td>{player.name}</td>
                <td>{Math.round(player.rating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
