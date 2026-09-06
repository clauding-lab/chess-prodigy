import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../account/api";
import { Modal } from "../ui/Modal";
import { listGames } from "./api";
import type { HeadToHead } from "./types";

interface HistoryState {
  userId: string;
  opponents: HeadToHead[];
  loading: boolean;
  error: string;
}

export function useHeadToHead(userId: string | null, path: string) {
  const [state, setState] = useState<HistoryState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!userId) return;
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [userId, refresh]);

  useEffect(() => {
    let active = true;
    setState((previous) =>
      userId
        ? {
            userId,
            opponents: previous?.userId === userId ? previous.opponents : [],
            loading: true,
            error: "",
          }
        : null,
    );
    if (!userId) return;
    void listGames(userId)
      .then(({ opponents }) => {
        if (active) setState({ userId, opponents, loading: false, error: "" });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setState((previous) => ({
          userId,
          opponents:
            reason instanceof ApiError && reason.status === 401
              ? []
              : previous?.userId === userId
                ? previous.opponents
                : [],
          loading: false,
          error: reason instanceof Error ? reason.message : "Could not load head-to-head results.",
        }));
      });
    return () => {
      active = false;
    };
  }, [userId, path, attempt]);

  return { history: state?.userId === userId ? state : null, refresh };
}

export function HeadToHeadModal({
  history,
  onClose,
  onRetry,
}: {
  history: HistoryState;
  onClose(): void;
  onRetry(): void;
}) {
  return (
    <Modal title="Head to head" onClose={onClose} className="account-modal">
      <p className="form-note">
        Your lifetime 1v1 results. Each matchup is visible only to you and that opponent.
      </p>
      {history.loading ? (
        <p role="status">Loading results…</p>
      ) : history.error ? (
        <>
          <p role="alert">{history.error}</p>
          <button className="btn" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <table className="leaderboard h2h-table">
          <thead>
            <tr>
              <th scope="col">Opponent</th>
              <th scope="col">Your wins</th>
              <th scope="col">Draws</th>
              <th scope="col">Your losses</th>
            </tr>
          </thead>
          <tbody>
            {history.opponents.map((score) => (
              <tr key={score.opponent.id}>
                <td>{score.opponent.name}</td>
                <td>{score.wins}</td>
                <td>{score.draws}</td>
                <td>{score.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
