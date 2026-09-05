import { START, applyMove, legalMoves, posKey, sameMove, sanFor } from "../engine/board";
import type { Move, Piece, Position } from "../engine/types";
import { MOTIF_KEYS } from "../coach/types";
import { TIME_CONTROLS } from "../game/state";
import type { Game, HistoryEntry, RatingReceipt, Session } from "../game/types";
import { ENGINE_ELO, LEVEL_LABEL, ratingUpdate } from "../rating/fide";
import type { Rating, RatingEntry } from "../rating/fide";

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const integer = (value: unknown, min = 0): value is number =>
  finite(value) && Number.isSafeInteger(value) && value >= min;
const bool = (value: unknown): value is boolean => typeof value === "boolean";
const text = (value: unknown): value is string => typeof value === "string";
const oneOf = <T extends string>(value: unknown, choices: readonly T[]): value is T =>
  typeof value === "string" && choices.includes(value as T);
const numberOneOf = <T extends number>(value: unknown, choices: readonly T[]): value is T =>
  typeof value === "number" && choices.includes(value as T);
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const equalMove = (a: Move, b: Move): boolean =>
  a.from === b.from &&
  a.to === b.to &&
  a.promo === b.promo &&
  a.capture === b.capture &&
  a.ep === b.ep &&
  a.double === b.double &&
  a.castle === b.castle;

function validRatingEntry(value: unknown): value is RatingEntry {
  if (!object(value)) return false;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date)) &&
    !Number.isNaN(Date.parse(`${String(value.date)}T00:00:00+06:00`)) &&
    text(value.opp) &&
    finite(value.oppRating) &&
    value.oppRating >= 0 &&
    value.oppRating <= 10_000 &&
    finite(value.score) &&
    value.score >= 0 &&
    value.score <= 1 &&
    finite(value.delta) &&
    finite(value.after) &&
    numberOneOf(value.K, [10, 20, 40] as const)
  );
}

export function isRating(value: unknown): value is Rating {
  if (
    !object(value) ||
    !finite(value.rating) ||
    value.rating < 1400 ||
    value.rating > 10_000 ||
    !integer(value.games) ||
    !finite(value.peak) ||
    value.peak < value.rating ||
    value.peak > 10_000 ||
    !bool(value.reached2400) ||
    !Array.isArray(value.history) ||
    value.history.length > 50 ||
    !value.history.every(validRatingEntry)
  )
    return false;
  if (value.games < value.history.length) return false;
  for (let i = 0; i < value.history.length; i++) {
    const entry = value.history[i];
    if (entry.after < 1400 || Math.abs(entry.delta) > entry.K + Number.EPSILON) return false;
    if (i && Math.abs(value.history[i - 1].after + entry.delta - entry.after) > 1e-9) return false;
  }
  return !value.history.length || Math.abs(value.history.at(-1)!.after - value.rating) < 1e-9;
}

function validPosition(value: unknown): value is Position {
  if (!object(value) || !Array.isArray(value.board) || value.board.length !== 64) return false;
  const pieces = ["wp", "wn", "wb", "wr", "wq", "wk", "bp", "bn", "bb", "br", "bq", "bk"];
  if (!value.board.every((piece) => piece === null || oneOf(piece, pieces))) return false;
  if (
    value.board.filter((p) => p === "wk").length !== 1 ||
    value.board.filter((p) => p === "bk").length !== 1
  )
    return false;
  if (!oneOf(value.turn, ["w", "b"] as const) || !object(value.castling)) return false;
  const castling = value.castling;
  if (!["K", "Q", "k", "q"].every((key) => bool(castling[key]))) return false;
  return (
    (value.ep === null || (integer(value.ep) && value.ep < 64)) &&
    integer(value.halfmove) &&
    integer(value.fullmove, 1)
  );
}

function validMove(value: unknown): value is Move {
  if (
    !object(value) ||
    !integer(value.from) ||
    value.from > 63 ||
    !integer(value.to) ||
    value.to > 63
  )
    return false;
  if (value.promo !== undefined && !oneOf(value.promo, ["q", "r", "b", "n"] as const)) return false;
  if (
    value.capture !== undefined &&
    !oneOf(value.capture, [
      "wp",
      "wn",
      "wb",
      "wr",
      "wq",
      "wk",
      "bp",
      "bn",
      "bb",
      "br",
      "bq",
      "bk",
    ] as Piece[])
  )
    return false;
  if (value.ep !== undefined && !bool(value.ep)) return false;
  if (value.double !== undefined && !bool(value.double)) return false;
  return value.castle === undefined || oneOf(value.castle, ["K", "Q"] as const);
}

function validClocks(value: unknown): value is { w: number; b: number } {
  return object(value) && finite(value.w) && value.w >= 0 && finite(value.b) && value.b >= 0;
}

function validHistoryShape(value: unknown): value is HistoryEntry {
  if (
    !object(value) ||
    !validPosition(value.before) ||
    !validMove(value.mv) ||
    !text(value.san) ||
    !text(value.keyAfter) ||
    !Array.isArray(value.motifs) ||
    !bool(value.book) ||
    !(value.ann === null || oneOf(value.ann, ["", "book", "??", "?", "?!", "!"] as const)) ||
    !(value.better === null || text(value.better)) ||
    !(value.clocksBefore === null || validClocks(value.clocksBefore))
  )
    return false;
  return value.motifs.every(
    (m) =>
      object(m) && oneOf(m.key, MOTIF_KEYS) && text(m.detail) && oneOf(m.side, ["w", "b"] as const),
  );
}

function validReceipt(value: unknown): value is RatingReceipt {
  return (
    object(value) &&
    text(value.gameId) &&
    isRating(value.before) &&
    finite(value.delta) &&
    finite(value.after) &&
    Math.abs(value.before.rating + value.delta - value.after) < 1e-9
  );
}

function validGameShape(value: unknown): value is Game {
  if (
    !object(value) ||
    !text(value.id) ||
    !value.id ||
    !integer(value.revision) ||
    !validPosition(value.st) ||
    !Array.isArray(value.hist) ||
    !value.hist.every(validHistoryShape) ||
    !object(value.keys) ||
    !object(value.setup) ||
    !oneOf(value.setup.playerColor, ["w", "b"] as const) ||
    !oneOf(value.setup.level, ["casual", "club", "strong"] as const) ||
    !oneOf(value.setup.time, ["none", "5+0", "10+0", "15+10"] as const) ||
    !(value.clocks === null || validClocks(value.clocks)) ||
    !integer(value.clockAt) ||
    !bool(value.started) ||
    !bool(value.rated) ||
    !bool(value.hintUsed) ||
    !(value.ratingApplied === null || validReceipt(value.ratingApplied)) ||
    !object(value.evals)
  )
    return false;
  if (!(
    value.over === null ||
    (object(value.over) &&
      oneOf(value.over.result, ["1-0", "0-1", "½-½"] as const) &&
      text(value.over.reason))
  ))
    return false;
  if (!Object.values(value.keys).every((count) => integer(count))) return false;
  return Object.entries(value.evals).every(
    ([ply, evaluation]) =>
      /^\d+$/.test(ply) &&
      object(evaluation) &&
      finite(evaluation.score) &&
      (evaluation.best === null || validMove(evaluation.best)),
  );
}

function replayMatches(game: Game): boolean {
  let position = START();
  const positions: Position[] = [position];
  const keys: Record<string, number> = { [posKey(position)]: 1 };
  for (const entry of game.hist) {
    if (!equal(entry.before, position)) return false;
    const move = legalMoves(position).find((candidate) => sameMove(candidate, entry.mv));
    if (!move || !equalMove(entry.mv, move)) return false;
    const next = applyMove(position, move);
    if (entry.san !== sanFor(position, move, next)) return false;
    position = next;
    positions.push(position);
    const key = posKey(position);
    if (entry.keyAfter !== key) return false;
    keys[key] = (keys[key] ?? 0) + 1;
  }
  const positiveStoredKeys = Object.fromEntries(
    Object.entries(game.keys).filter(([, count]) => count > 0),
  );
  if (!(
    equal(position, game.st) &&
    equal(keys, positiveStoredKeys) &&
    (game.hist.length === 0 || game.started)
  ))
    return false;
  for (const [plyText, evaluation] of Object.entries(game.evals)) {
    const ply = Number(plyText),
      at = positions[ply];
    if (
      !at ||
      (evaluation.best && !legalMoves(at).some((move) => equalMove(move, evaluation.best!)))
    )
      return false;
  }
  return clocksMatch(game);
}

function clocksMatch(game: Game): boolean {
  const control = TIME_CONTROLS[game.setup.time];
  if (control.ms === null)
    return game.clocks === null && game.hist.every((entry) => entry.clocksBefore === null);
  if (!game.clocks || game.hist.some((entry) => !entry.clocksBefore)) return false;
  const moves = { w: 0, b: 0 };
  const bounded = (clocks: { w: number; b: number }): boolean =>
    clocks.w <= control.ms! + moves.w * control.inc &&
    clocks.b <= control.ms! + moves.b * control.inc;
  for (const entry of game.hist) {
    if (!bounded(entry.clocksBefore!)) return false;
    moves[entry.before.turn]++;
  }
  return bounded(game.clocks);
}

function receiptMatches(session: Session): boolean {
  const receipt = session.game.ratingApplied;
  if (!receipt) return !(session.game.over && session.game.rated);
  if (receipt.gameId !== session.game.id || !session.game.over || !session.game.rated) return false;
  const last = session.rating.history.at(-1);
  if (!last) return false;
  const score =
    session.game.over.result === "½-½"
      ? 0.5
      : (session.game.over.result === "1-0" ? "w" : "b") === session.game.setup.playerColor
        ? 1
        : 0;
  const now = Date.parse(`${last.date}T00:00:00+06:00`);
  const expected = ratingUpdate(
    receipt.before,
    ENGINE_ELO[session.game.setup.level],
    score,
    {
      opp:
        LEVEL_LABEL[session.game.setup.level] +
        (session.game.over.reason === "Abandoned" ? " (abandoned)" : ""),
    },
    now,
  );
  return (
    equal(expected.next, session.rating) &&
    Math.abs(expected.delta - receipt.delta) < 1e-9 &&
    Math.abs(receipt.after - expected.next.rating) < 1e-9
  );
}

export function parseSavedState(value: unknown): Session | null {
  if (
    !object(value) ||
    value.version !== 1 ||
    !isRating(value.rating) ||
    !validGameShape(value.game) ||
    !object(value.preferences)
  )
    return null;
  if (
    !oneOf(value.preferences.theme, ["wood", "dark"] as const) ||
    !bool(value.preferences.sound) ||
    !bool(value.preferences.coach) ||
    !bool(value.preferences.flipped)
  )
    return null;
  const session = value as unknown as Session;
  if (session.game.hintUsed && session.game.rated) return null;
  return replayMatches(session.game) && receiptMatches(session) ? session : null;
}
