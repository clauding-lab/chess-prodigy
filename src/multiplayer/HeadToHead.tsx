import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../account/api";
import { Modal } from "../ui/Modal";
import { listGames } from "./api";
import type { HeadToHead } from "./types";

interface HistoryState {
  userId: string;
  opponents: HeadToHead[];
  loading: boolean;
  error: string;
  nextOpponents?: string | null;
  loadMore?(): void;
}

export function useHeadToHead(userId: string | null, path: string) {
  const [state, setState] = useState<HistoryState | null>(null);
  const generation = useRef(0);
  const morePending = useRef(false);
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
    const currentGeneration = ++generation.current;
    morePending.current = false;
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
      .then(({ opponents, nextOpponents }) => {
        if (active) setState({ userId, opponents, nextOpponents, loading: false, error: "" });
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
      generation.current = currentGeneration + 1;
    };
  }, [userId, path, attempt]);

  const loadMore = () => {
    if (!userId || state?.userId !== userId || !state.nextOpponents || morePending.current) return;
    const captured = generation.current;
    morePending.current = true;
    setState((previous) => (previous ? { ...previous, loading: true, error: "" } : previous));
    void listGames(userId, state.nextOpponents)
      .then((page) => {
        if (generation.current !== captured) return;
        setState((previous) =>
          previous?.userId === userId
            ? {
                ...previous,
                opponents: [
                  ...previous.opponents,
                  ...page.opponents.filter(
                    (p) => !previous.opponents.some((old) => old.opponent.id === p.opponent.id),
                  ),
                ],
                nextOpponents: page.nextOpponents,
                loading: false,
                error: "",
              }
            : previous,
        );
      })
      .catch((reason: unknown) => {
        if (generation.current !== captured) return;
        setState((previous) =>
          previous
            ? {
                ...previous,
                loading: false,
                ...(reason instanceof ApiError && reason.status === 401
                  ? { opponents: [], nextOpponents: null }
                  : {}),
                error: reason instanceof Error ? reason.message : "Could not load more results.",
              }
            : previous,
        );
      })
      .finally(() => {
        if (generation.current === captured) morePending.current = false;
      });
  };
  return { history: state?.userId === userId ? { ...state, loadMore } : null, refresh };
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
      {history.nextOpponents && (
        <button className="btn" disabled={history.loading} onClick={history.loadMore}>
          Load more opponents
        </button>
      )}
    </Modal>
  );
}
