import { expect, it } from "vitest";
import { applyMove, legalMoves, sanFor } from "../../src/engine/board";
import { freshSession, reduceSession } from "../../src/game/state";
import type { Session } from "../../src/game/types";
import { parseSavedState } from "../../src/storage/schema";
import { loadSavedState, saveState } from "../../src/storage/store";
import { saveGuestProgress } from "../../src/storage/history";

function play(session: Session, san: string): Session {
  const position = session.game.st;
  const move = legalMoves(position).find(
    (candidate) => sanFor(position, candidate, applyMove(position, candidate)) === san,
  );
  if (!move) throw new Error(`Illegal fixture move: ${san}`);
  return reduceSession(session, { type: "move", move, book: false, now: session.game.clockAt + 1 });
}

function transposed() {
  let session = freshSession(1000, "transposition");
  for (const san of ["e4", "e5", "Nf3", "Nc6"]) session = play(session, san);
  session = reduceSession(session, { type: "undo", now: 2000 });
  session = reduceSession(session, { type: "undo", now: 2001 });
  for (const san of ["Nf3", "e5", "e4"]) session = play(session, san);
  return session;
}

it("saves and reloads a legal transposition after takebacks, including its terminal archive", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const session = transposed();
  expect(parseSavedState(session)).not.toBeNull();
  expect(saveState(storage, session)).toBe(true);
  expect(loadSavedState(storage, 3000, "fallback").session.game).toEqual({
    ...session.game,
    keys: Object.fromEntries(Object.entries(session.game.keys).filter(([, count]) => count > 0)),
  });
  const ended = reduceSession(session, { type: "resign", now: 4000 });
  expect(saveGuestProgress(storage, ended)).toBe(true);
  expect(loadSavedState(storage, 4001, "fallback").session.game.over).toEqual(ended.game.over);
});

it("accepts reordered positive counts and retained zero entries without accepting forged counts", () => {
  const session = transposed();
  session.game.keys = Object.fromEntries(Object.entries(session.game.keys).reverse());
  expect(parseSavedState(session)).not.toBeNull();
  const positive = Object.keys(session.game.keys).find((key) => session.game.keys[key] > 0)!;
  for (const keys of [
    { ...session.game.keys, [positive]: session.game.keys[positive] + 1 },
    Object.fromEntries(Object.entries(session.game.keys).filter(([key]) => key !== positive)),
    { ...session.game.keys, forged: 1 },
  ])
    expect(parseSavedState({ ...session, game: { ...session.game, keys } })).toBeNull();
});
