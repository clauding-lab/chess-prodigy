import { useCallback, useEffect, useRef, useState } from "react";
import { applyMove, legalMoves, sameMove, sanFor } from "../engine/board";
import type { Move, Position } from "../engine/types";
import { bookLookup } from "../book/book";
import { EngineClient } from "../worker/client";
import { loadSavedState, saveState } from "../storage/store";
import { reduceSession, settlePriorGame } from "./state";
import type { Preferences, SessionAction, Setup } from "./types";
import { playSound } from "./sound";
import type { LoadResult } from "../storage/store";
import { isSupportedOpponent } from "../engine/opponents";
import {
  REVIEWER,
  isNeutralEvaluation,
  reusableReview,
  reviewHistory,
  type ReviewPolicy,
} from "../engine/reviewer";

export interface GameStorageAdapter {
  load(now: number, fallbackId: string): LoadResult;
  save(session: LoadResult["session"], options?: { terminal?: boolean }): boolean;
}

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const newId = () => crypto.randomUUID();
const defaultStorage: GameStorageAdapter = {
  load: (now, fallbackId) => loadSavedState(browserStorage(), now, fallbackId),
  save: (session) => saveState(browserStorage(), session),
};
export function useGame(
  paused: boolean,
  storage: GameStorageAdapter = defaultStorage,
  background = false,
) {
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const [initial] = useState(() => storage.load(Date.now(), newId()));
  const [session, setSession] = useState(initial.session);
  const current = useRef(session);
  const [storageStatus, setStorageStatus] = useState(initial.status);
  const storageState = useRef(initial.status);
  const [thinking, setThinking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [hint, setHint] = useState<{ move: Move; san: string; score: number } | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const [retry, setRetry] = useState(0);
  const client = useRef<EngineClient | null>(null);
  const generation = useRef(0);
  const cancelDelay = useRef<(() => void) | null>(null);
  const busy = useRef<"ai" | "hint" | "review" | "passive" | null>(null);
  const mounted = useRef(false);
  const persist = useCallback(
    (session = current.current, options?: { terminal?: boolean }) => {
      if (storageState.current === "corrupt" || !isSupportedOpponent(session.game.opponent))
        return false;
      const status = storage.save(session, options) ? "saved" : "unavailable";
      storageState.current = status;
      setStorageStatus(status);
      return status === "saved";
    },
    [storage],
  );
  const invalidateWork = useCallback(() => {
    generation.current++;
    cancelDelay.current?.();
    cancelDelay.current = null;
    client.current?.cancel();
    busy.current = null;
  }, []);
  const invalidate = useCallback(() => {
    invalidateWork();
    setThinking(false);
    setReviewing(false);
  }, [invalidateWork]);
  const dispatch = useCallback(
    (action: SessionAction) => {
      const previous = current.current;
      if (action.type === "new") {
        const prior = settlePriorGame(previous, action.now);
        if (prior.game.over) persist(prior, { terminal: true });
      }
      const next = reduceSession(previous, action);
      if (next === previous) return;
      const changedPosition =
        next.game.id !== previous.game.id || next.game.revision !== previous.game.revision;
      if (changedPosition) {
        invalidate();
        setHint(null);
        errorRef.current = null;
        setEngineError(null);
      }
      current.current = next;
      setSession(next);
      if (action.type === "move" && next.game.hist.length > previous.game.hist.length)
        playSound(
          next.game.over ? "end" : next.game.hist.at(-1)?.mv.capture ? "capture" : "move",
          next.preferences.sound && !backgroundRef.current,
        );
      else if (!previous.game.over && next.game.over && action.type !== "new")
        playSound("end", next.preferences.sound && !backgroundRef.current);
      if (action.type !== "tick" || next.game.over !== previous.game.over) persist();
    },
    [invalidate, persist],
  );
  useEffect(() => {
    mounted.current = true;
    client.current = new EngineClient();
    persist();
    const tick = () => dispatch({ type: "tick", now: Date.now() });
    const save = () => {
      tick();
      persist();
    };
    const timer = setInterval(tick, 200);
    window.addEventListener("focus", tick);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      mounted.current = false;
      invalidateWork();
      client.current?.dispose();
      client.current = null;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [dispatch, persist, invalidateWork]);
  const fail = useCallback((error: unknown, token: number) => {
    if (
      !mounted.current ||
      generation.current !== token ||
      (error instanceof Error && error.name === "AbortError")
    )
      return;
    const message =
      error instanceof Error ? error.message : "Engine calculation failed. Please try again.";
    errorRef.current = message;
    setEngineError(message);
  }, []);
  const analyse = useCallback(
    async (position: Position, ply: number, token: number, policy: ReviewPolicy) => {
      const g = current.current.game;
      const result = await client.current!.request({
        type: "analyse",
        position,
        gameId: g.id,
        revision: g.revision,
        reviewer: REVIEWER,
        policy,
        history: reviewHistory(g, ply),
      });
      if (!mounted.current || generation.current !== token) return null;
      if (result.score === null || !("review" in result))
        throw new Error("Engine returned no neutral evaluation.");
      const value = { score: result.score, best: result.move, review: result.review };
      if (!isNeutralEvaluation(value, position, reviewHistory(g, ply), policy))
        throw new Error("Engine returned an incompatible review.");
      if (policy === "hint-v1") return result;
      dispatch({
        type: "evaluation",
        gameId: g.id,
        revision: g.revision,
        ply,
        value,
      });
      return result;
    },
    [dispatch],
  );
  const game = session.game;
  useEffect(() => {
    if (
      paused ||
      !isSupportedOpponent(current.current.game.opponent) ||
      (background && !current.current.game.clocks) ||
      !client.current ||
      errorRef.current ||
      busy.current === "hint" ||
      busy.current === "review"
    )
      return;
    const g = current.current.game,
      token = ++generation.current;
    const ai = !g.over && g.st.turn !== g.setup.playerColor;
    busy.current = ai ? "ai" : "passive";
    setThinking(ai);
    const run = async () => {
      if (ai) {
        const readyAt = Date.now() + 1000;
        const result = await client.current!.request({
          type: "ai",
          gameId: g.id,
          revision: g.revision,
          position: g.st,
          level: g.setup.level,
          opponent: g.opponent,
          ply: g.hist.length,
          bookSans: bookLookup(g.hist.map((e) => e.san)).replies,
        });
        if (!mounted.current || generation.current !== token) return;
        if (!result.move || !legalMoves(g.st).some((m) => sameMove(m, result.move!)))
          throw new Error("Engine returned no legal move. Please retry.");
        const remaining = readyAt - Date.now();
        if (remaining > 0) {
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              cancelDelay.current = null;
              resolve();
            }, remaining);
            cancelDelay.current = () => {
              window.clearTimeout(timer);
              resolve();
            };
          });
        }
        if (!mounted.current || generation.current !== token) return;
        dispatch({
          type: "move",
          move: result.move,
          book: "book" in result && result.book,
          now: Date.now(),
        });
      } else if (current.current.preferences.coach) {
        for (const ply of [...new Set([Math.max(0, g.hist.length - 1), g.hist.length])]) {
          if (generation.current !== token) return;
          if (
            !reusableReview(
              current.current.game.evals[ply],
              ply === g.hist.length ? g.st : g.hist[ply].before,
              reviewHistory(g, ply),
            )
          )
            await analyse(
              ply === g.hist.length ? g.st : g.hist[ply].before,
              ply,
              token,
              "review-v1",
            );
        }
      }
    };
    void run()
      .catch((e) => fail(e, token))
      .finally(() => {
        if (mounted.current && generation.current === token) {
          busy.current = null;
          setThinking(false);
        }
      });
    return () => {
      invalidateWork();
      setThinking(false);
    };
  }, [
    game.id,
    game.revision,
    session.preferences.coach,
    paused,
    background,
    retry,
    analyse,
    dispatch,
    fail,
    invalidateWork,
  ]);
  const cancelReview = useCallback(() => {
    invalidate();
    setRetry((n) => n + 1);
  }, [invalidate]);
  function askHint() {
    const g = current.current.game;
    if (!isSupportedOpponent(g.opponent) || g.over || g.st.turn !== g.setup.playerColor) return;
    invalidate();
    dispatch({ type: "hint" });
    const token = ++generation.current;
    busy.current = "hint";
    setThinking(true);
    void analyse(g.st, g.hist.length, token, "hint-v1")
      .then((result) => {
        if (result?.move && result.score !== null && generation.current === token)
          setHint({
            move: result.move,
            san: sanFor(g.st, result.move, applyMove(g.st, result.move)),
            score: result.score,
          });
      })
      .catch((e) => fail(e, token))
      .finally(() => {
        if (mounted.current && generation.current === token) {
          busy.current = null;
          setThinking(false);
          setRetry((n) => n + 1);
        }
      });
  }
  function review() {
    const g = current.current.game;
    if (
      !isSupportedOpponent(g.opponent) ||
      !g.started ||
      (!g.over && g.st.turn !== g.setup.playerColor)
    )
      return;
    invalidate();
    const token = ++generation.current;
    busy.current = "review";
    setReviewing(true);
    const run = async () => {
      for (let ply = 0; ply <= g.hist.length; ply++) {
        if (generation.current !== token) return;
        await analyse(ply === g.hist.length ? g.st : g.hist[ply].before, ply, token, "review-v1");
      }
    };
    void run()
      .catch((e) => fail(e, token))
      .finally(() => {
        if (mounted.current && generation.current === token) {
          busy.current = null;
          setReviewing(false);
          setRetry((n) => n + 1);
        }
      });
  }
  return {
    game: session.game,
    rating: session.rating,
    preferences: session.preferences,
    hasSavedGame: initial.session.game.started,
    thinking,
    reviewing,
    hint,
    engineError,
    storageStatus,
    startGame: (setup: Setup) => dispatch({ type: "new", setup, now: Date.now(), id: newId() }),
    move: (move: Move) => {
      const g = current.current.game;
      if (g.st.turn !== g.setup.playerColor || g.over) return;
      const book = bookLookup(g.hist.map((e) => e.san));
      const legal = legalMoves(g.st).find((m) => sameMove(m, move));
      if (!legal) return;
      dispatch({
        type: "move",
        move: legal,
        book: book.inBook && book.replies.includes(sanFor(g.st, legal, applyMove(g.st, legal))),
        now: Date.now(),
      });
    },
    undo: () => dispatch({ type: "undo", now: Date.now() }),
    resign: () => dispatch({ type: "resign", now: Date.now() }),
    askHint,
    review,
    cancelReview,
    setPreferences: (value: Partial<Preferences>) => dispatch({ type: "preferences", value }),
    resetRating: () => dispatch({ type: "resetRating" }),
    retryEngine: () => {
      errorRef.current = null;
      setEngineError(null);
      setRetry((n) => n + 1);
    },
    enableSaving: () => {
      storageState.current = "unavailable";
      persist();
    },
    saveNow: persist,
  };
}
