import {
  START,
  applyMove,
  insufficientMaterial,
  legalMoves,
  posKey,
  sanFor,
} from "../engine/board";
import { detectMotifs } from "../coach/motifs";
import type { Game, HistoryEntry, Session } from "../game/types";
import type { Move } from "../engine/types";
import { isRating, isUnratedReason, parseSavedState, validGameShape } from "./schema";
import { isOpponentConfig } from "../engine/opponents";
import { MAX_COMPACT_BYTES, MAX_GAME_PLIES } from "./capacity";

// Board copies and neutral review caches can be reconstructed from these moves.
export type CompactMove = [
  number,
  number,
  Move["promo"] | null,
  number | null,
  number | null,
  boolean,
];
export interface CompactSession {
  version: 3;
  game: Omit<Game, "hist" | "st" | "keys" | "evals"> & { moves: CompactMove[] };
  rating: Session["rating"];
  preferences: Session["preferences"];
}
export function encodeCompactSession(session: Session): CompactSession {
  const g = session.game;
  return {
    version: 3,
    game: {
      id: g.id,
      ...(g.engineInterruption ? { engineInterruption: g.engineInterruption } : {}),
      revision: g.revision,
      over: g.over,
      setup: g.setup,
      opponent: g.opponent,
      unratedReason: g.unratedReason,
      takebackUsed: g.takebackUsed,
      clocks: g.clocks,
      clockAt: g.clockAt,
      started: g.started,
      rated: g.rated,
      hintUsed: g.hintUsed,
      ratingApplied: g.ratingApplied,
      moves: g.hist.map((entry) => [
        entry.mv.from,
        entry.mv.to,
        entry.mv.promo ?? null,
        entry.clocksBefore?.w ?? null,
        entry.clocksBefore?.b ?? null,
        entry.book,
      ]),
    },
    rating: session.rating,
    preferences: session.preferences,
  };
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const square = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) < 64;
function validTuple(value: unknown): value is CompactMove {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    square(value[0]) &&
    square(value[1]) &&
    (value[2] === null || ["q", "r", "b", "n"].includes(value[2])) &&
    ((value[3] === null && value[4] === null) ||
      [value[3], value[4]].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) &&
    typeof value[5] === "boolean"
  );
}
export function decodeCompactSession(value: unknown): Session | null {
  if (!object(value) || value.version !== 3 || !object(value.game)) return null;
  // Bound serialization and shape before legal replay, including non-JSON callers.
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_COMPACT_BYTES) return null;
  } catch {
    return null;
  }
  const g = value.game;
  if (!Array.isArray(g.moves) || g.moves.length > MAX_GAME_PLIES) return null;
  const moves = Array.from(g.moves);
  if (!moves.every(validTuple)) return null;
  const start = START();
  if (
    !isRating(value.rating) ||
    !object(value.preferences) ||
    !["dark", "wood"].includes(String(value.preferences.theme)) ||
    ![value.preferences.sound, value.preferences.coach, value.preferences.flipped].every(
      (v) => typeof v === "boolean",
    ) ||
    !isOpponentConfig(g.opponent) ||
    !isUnratedReason(g.unratedReason) ||
    !(g.takebackUsed === null || typeof g.takebackUsed === "boolean") ||
    !validGameShape({ ...g, st: start, hist: [], keys: { [posKey(start)]: 1 }, evals: {} })
  )
    return null;
  // Validate scalar metadata using an empty legal board before expensive replay.
  // The actual receipt must be checked against the reconstructed final outcome.
  if (
    typeof g.id !== "string" ||
    g.id.length > 256 ||
    !(
      g.over === null ||
      (object(g.over) &&
        ["1-0", "0-1", "½-½"].includes(String(g.over.result)) &&
        typeof g.over.reason === "string" &&
        g.over.reason.length <= 128)
    )
  )
    return null;
  let st = start;
  const hist: HistoryEntry[] = [];
  const keys: Record<string, number> = { [posKey(st)]: 1 };
  for (const [index, tuple] of moves.entries()) {
    if (st.halfmove >= 100 || keys[posKey(st)] >= 3 || insufficientMaterial(st.board)) return null;
    const [from, to, promo, w, b, book] = tuple;
    const mv = legalMoves(st).find(
      (move) => move.from === from && move.to === to && (move.promo ?? null) === promo,
    );
    if (!mv) return null;
    const before = st;
    st = applyMove(st, mv);
    const keyAfter = posKey(st);
    keys[keyAfter] = (keys[keyAfter] ?? 0) + 1;
    hist.push({
      before,
      mv,
      san: sanFor(before, mv, st),
      keyAfter,
      clocksBefore: w === null || b === null ? null : { w, b },
      book,
      motifs: detectMotifs(
        before,
        mv,
        st,
        index === moves.length - 1 ? (g.over as Game["over"]) : null,
      ),
      ann: null,
      better: null,
    });
  }
  const { moves: _moves, ...metadata } = g;
  return parseSavedState({
    rating: value.rating,
    preferences: value.preferences,
    version: 2,
    game: { ...metadata, st, hist, keys, evals: {} },
  });
}
