import {
  START,
  applyMove,
  legalMoves,
  sameMove,
  sanFor,
  posKey,
  inCheck,
  insufficientMaterial,
} from "../engine/board";
import { detectMotifs } from "../coach/motifs";
import { annotateAll } from "../coach/annotate";
import { isNeutralEvaluation, reviewHistory } from "../engine/reviewer";
import { defaultRating, ratingUpdate } from "../rating/fide";
import type { Action, Game, GameResult, Setup, Session, SessionAction, TimeControl } from "./types";
import { CLASSIC, isRatedOpponent, isSupportedOpponent } from "../engine/opponents";
import { opponentPracticeRating, opponentRatingLabel } from "../rating/opponents";
export const TIME_CONTROLS: Record<TimeControl, { label: string; ms: number | null; inc: number }> =
  {
    none: { label: "No clock", ms: null, inc: 0 },
    "5+0": { label: "5 min", ms: 300000, inc: 0 },
    "10+0": { label: "10 min", ms: 600000, inc: 0 },
    "15+10": { label: "15 | 10", ms: 900000, inc: 10000 },
  };
export function freshGame(setup: Setup, now: number, id: string): Game {
  const opponent = { ...(setup.opponent ?? CLASSIC) };
  if (!isSupportedOpponent(opponent))
    throw new Error("This opponent configuration is unavailable. Saved progress is preserved.");
  if (isRatedOpponent(opponent) && opponentPracticeRating(opponent, setup.level) === null)
    throw new Error("This opponent difficulty has no measured rating yet.");
  const st = START(),
    ms = TIME_CONTROLS[setup.time].ms;
  return {
    id,
    revision: 0,
    st,
    hist: [],
    keys: { [posKey(st)]: 1 },
    over: null,
    setup: { playerColor: setup.playerColor, level: setup.level, time: setup.time },
    opponent,
    unratedReason: isRatedOpponent(opponent) ? null : "beta",
    takebackUsed: false,
    clocks: ms === null ? null : { w: ms, b: ms },
    clockAt: now,
    started: false,
    rated: isRatedOpponent(opponent),
    hintUsed: false,
    ratingApplied: null,
    evals: {},
  };
}
export function freshSession(now: number, id: string): Session {
  return {
    version: 2,
    game: freshGame({ playerColor: "w", level: "club", time: "none" }, now, id),
    rating: defaultRating(),
    preferences: { theme: "dark", sound: true, coach: true, flipped: false },
  };
}
export function settleClock(g: Game, now: number): Game {
  if (!isSupportedOpponent(g.opponent)) return g;
  if (!g.clocks || g.over || !g.started) return g;
  const elapsed = Math.max(0, now - g.clockAt);
  if (!elapsed) return g;
  const side = g.st.turn,
    left = Math.max(0, g.clocks[side] - elapsed);
  const opponent = side === "w" ? "b" : "w";
  // Narrow correction only: a bare king cannot deliver checkmate. Do not infer
  // every possible timeout draw from the general insufficient-material helper.
  const bareKing =
    left === 0 && g.st.board.every((piece) => !piece || piece[0] !== opponent || piece[1] === "k");
  return {
    ...g,
    clockAt: now,
    clocks: { ...g.clocks, [side]: left },
    revision: left === 0 ? g.revision + 1 : g.revision,
    over:
      left === 0
        ? bareKing
          ? { result: "½-½", reason: "Time out" }
          : { result: side === "w" ? "0-1" : "1-0", reason: "Time out" }
        : null,
  };
}
export function reduceGame(g: Game, action: Action): Game {
  if (!isSupportedOpponent(g.opponent)) return g;
  if (action.type === "tick") return settleClock(g, action.now);
  if (action.type === "hint")
    return g.over
      ? g
      : { ...g, rated: false, hintUsed: true, unratedReason: g.unratedReason ?? "hint" };
  if (action.type === "evaluation") {
    if (
      action.gameId !== g.id ||
      action.revision !== g.revision ||
      action.ply < 0 ||
      action.ply > g.hist.length ||
      !isNeutralEvaluation(
        action.value,
        g.hist[action.ply]?.before ?? g.st,
        reviewHistory(g, action.ply),
      )
    )
      return g;
    return annotateAll({ ...g, evals: { ...g.evals, [action.ply]: action.value } });
  }
  if (action.type === "undo") {
    if (!g.hist.length) return g;
    const hist = g.hist.slice(),
      keys = { ...g.keys };
    let st = g.st,
      clocks = g.clocks;
    while (hist.length) {
      const e = hist.pop()!;
      keys[e.keyAfter] = Math.max(0, (keys[e.keyAfter] || 1) - 1);
      st = e.before;
      clocks = e.clocksBefore;
      if (st.turn === g.setup.playerColor) break;
    }
    const evals = Object.fromEntries(
      Object.entries(g.evals).filter(([k]) => Number(k) <= hist.length),
    );
    return {
      ...g,
      st,
      hist,
      keys,
      clocks,
      clockAt: action.now,
      revision: g.revision + 1,
      evals,
      over: null,
      rated: false,
      takebackUsed: true,
      unratedReason: g.unratedReason ?? "takeback",
      ratingApplied: null,
    };
  }
  if (g.over) return g;
  g = settleClock(g, action.now);
  if (g.over) return g;
  if (action.type === "resign") {
    if (!g.started) return g;
    return {
      ...g,
      revision: g.revision + 1,
      clockAt: action.now,
      over: { result: g.setup.playerColor === "w" ? "0-1" : "1-0", reason: "Resignation" },
    };
  }
  const mv = legalMoves(g.st).find((m) => sameMove(m, action.move));
  if (!mv) return g;
  const before = g.st,
    st = applyMove(before, mv),
    san = sanFor(before, mv, st),
    key = posKey(st);
  const keys = { ...g.keys, [key]: (g.keys[key] || 0) + 1 },
    moves = legalMoves(st);
  let over: GameResult | null = null;
  if (!moves.length)
    over = inCheck(st, st.turn)
      ? { result: before.turn === "w" ? "1-0" : "0-1", reason: "Checkmate" }
      : { result: "½-½", reason: "Stalemate" };
  else if (st.halfmove >= 100) over = { result: "½-½", reason: "Fifty-move rule" };
  else if (keys[key] >= 3) over = { result: "½-½", reason: "Threefold repetition" };
  else if (insufficientMaterial(st.board))
    over = { result: "½-½", reason: "Insufficient material" };
  const clocks = g.clocks
    ? { ...g.clocks, [before.turn]: g.clocks[before.turn] + TIME_CONTROLS[g.setup.time].inc }
    : null;
  const entry = {
    before,
    mv,
    san,
    keyAfter: key,
    motifs: detectMotifs(before, mv, st, over),
    book: action.book,
    ann: null,
    better: null,
    clocksBefore: g.clocks,
  };
  return {
    ...g,
    st,
    hist: [...g.hist, entry],
    keys,
    over,
    clocks,
    clockAt: action.now,
    revision: g.revision + 1,
    started: true,
  };
}
export function settleRating(s: Session, now: number): Session {
  const g = s.game;
  if (!isRatedOpponent(g.opponent) || !g.over || !g.rated || g.ratingApplied) return s;
  const score =
    g.over.result === "½-½"
      ? 0.5
      : (g.over.result === "1-0" ? "w" : "b") === g.setup.playerColor
        ? 1
        : 0;
  const opponentRating = opponentPracticeRating(g.opponent, g.setup.level);
  if (opponentRating === null) return s;
  const { next, delta } = ratingUpdate(
    s.rating,
    opponentRating,
    score,
    { opp: opponentRatingLabel(g.opponent, g.setup.level, g.over.reason === "Abandoned") },
    now,
  );
  return {
    ...s,
    rating: next,
    game: { ...g, ratingApplied: { gameId: g.id, before: s.rating, after: next.rating, delta } },
  };
}
export function settlePriorGame(s: Session, now: number): Session {
  if (!isSupportedOpponent(s.game.opponent)) return s;
  let prior = { ...s, game: settleClock(s.game, now) };
  if (prior.game.started && !prior.game.over)
    prior = {
      ...prior,
      game: {
        ...prior.game,
        clockAt: now,
        over: {
          result: prior.game.setup.playerColor === "w" ? "0-1" : "1-0",
          reason: "Abandoned",
        },
      },
    };
  return settleRating(prior, now);
}
export function reduceSession(s: Session, action: SessionAction): Session {
  if (action.type === "preferences")
    return { ...s, preferences: { ...s.preferences, ...action.value } };
  // Unknown saved versions are recoverable, never silently replaced or settled.
  if (!isSupportedOpponent(s.game.opponent)) return s;
  if (action.type === "forfeit") return settlePriorGame(s, action.now);
  if (action.type === "resetRating")
    return {
      ...s,
      rating: defaultRating(),
      game: {
        ...s.game,
        ratingApplied: null,
        rated: false,
        unratedReason: s.game.unratedReason ?? "rating-reset",
      },
    };
  if (action.type === "new") {
    const prior = settlePriorGame(s, action.now);
    return {
      ...prior,
      game: freshGame(action.setup, action.now, action.id),
      preferences: { ...prior.preferences, flipped: action.setup.playerColor === "b" },
    };
  }
  let rating = s.rating;
  if (action.type === "undo" && s.game.hist.length && s.game.ratingApplied?.gameId === s.game.id)
    rating = s.game.ratingApplied.before;
  const game = reduceGame(s.game, action);
  if (game === s.game && rating === s.rating) return s;
  const next = { ...s, game, rating };
  return settleRating(next, "now" in action ? action.now : game.clockAt);
}
