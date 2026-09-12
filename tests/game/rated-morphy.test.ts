import { expect, it } from "vitest";
import { freshSession, reduceSession, settleRating, settlePriorGame } from "../../src/game/state";
import { legalMoves, sanFor, applyMove } from "../../src/engine/board";
import {
  morphyConfig,
  ratedMorphyConfig,
  historicalMorphyConfig,
  plannedMorphyConfig,
  isRatedOpponent,
} from "../../src/engine/opponents";
import { parseSavedState } from "../../src/storage/schema";
import { parseGameRecord } from "../../src/account/records";
import { archiveGame } from "../../src/game/archive";

function game(beta = false) {
  return reduceSession(freshSession(0, "prior"), {
    type: "new",
    id: "morphy-rated",
    now: 0,
    setup: {
      playerColor: "b",
      level: "club",
      time: "none",
      opponent: beta ? morphyConfig(1) : ratedMorphyConfig(1),
    },
  });
}
function move(s: ReturnType<typeof game>, san: string) {
  const m = legalMoves(s.game.st).find(
    (m) => sanFor(s.game.st, m, applyMove(s.game.st, m)) === san,
  )!;
  return reduceSession(s, { type: "move", move: m, book: false, now: s.game.clockAt + 1 });
}
function win(beta = false) {
  let s = game(beta);
  for (const san of ["f3", "e5", "g4", "Qh4#"]) s = move(s, san);
  return s;
}
it("settles a new measured Morphy win once using the measured Club rating and validates its receipt", () => {
  const s = win();
  expect(s.game.rated).toBe(true);
  expect(s.rating.games).toBe(1);
  expect(s.rating.history.at(-1)).toMatchObject({
    opp: "Paul Morphy · Club",
    oppRating: 1375,
    score: 1,
  });
  expect(s.rating.rating).toBeCloseTo(1400 + 40 * (1 - 1 / (1 + 10 ** (-25 / 400))), 8);
  expect(settleRating(s, 99)).toBe(s);
  expect(parseSavedState(s)).toEqual(s);
  expect(parseGameRecord(archiveGame(s))).toMatchObject({
    rated: true,
    opponent: { version: 2 },
    unratedReason: null,
  });
  const wrong = structuredClone(s);
  wrong.rating.history[0].oppRating = 1350;
  expect(parseSavedState(wrong)).toBeNull();
});
it("never retrospectively rates beta wins and reverses only the measured game's own receipt", () => {
  const beta = win(true);
  expect(beta.rating.games).toBe(0);
  expect(beta.game.unratedReason).toBe("beta");
  expect(parseSavedState(beta)).toEqual(beta);
  const s = win(),
    undone = reduceSession(s, { type: "undo", now: 20 });
  expect(undone.rating).toEqual(s.game.ratingApplied!.before);
  expect(undone.game).toMatchObject({
    rated: false,
    unratedReason: "takeback",
    ratingApplied: null,
  });
  expect(parseSavedState(undone)).toEqual(undone);
});
it("hints exclude new Morphy results, while abandonment settles an unassisted game", () => {
  const started = move(game(), "e4");
  const assisted = reduceSession(started, { type: "hint" });
  const ended = reduceSession(assisted, { type: "resign", now: 4 });
  expect(ended.rating.games).toBe(0);
  expect(ended.game.unratedReason).toBe("hint");
  expect(parseSavedState(ended)).toEqual(ended);
  const abandoned = settlePriorGame(started, 4);
  expect(abandoned.rating.history.at(-1)).toMatchObject({
    opp: "Paul Morphy · Club (abandoned)",
    oppRating: 1375,
    score: 0,
  });
  expect(parseSavedState(abandoned)).toEqual(abandoned);
});

it("retains unknown Classic terminal receipts and archives as read-only history", () => {
  let s = freshSession(0, "future-classic");
  s = move(s, "e4");
  s = reduceSession(s, { type: "resign", now: 3 });
  s.game.opponent.version = 99;
  expect(parseSavedState(s)).toEqual(s);
  expect(parseGameRecord(archiveGame(s))).toMatchObject({
    opponent: { id: "classic", version: 99 },
    rated: true,
  });
  expect(settleRating(s, 9)).toBe(s);
});

it("does not accept a measured opponent labelled as a legacy beta or an inconsistent archive eligibility", () => {
  const s = game();
  s.game.rated = false;
  s.game.unratedReason = "beta";
  expect(parseSavedState(s)).toBeNull();
  const record = archiveGame(win())!;
  expect(parseGameRecord({ ...record, rated: false })).toBeNull();
  expect(parseGameRecord({ ...record, rated: false, unratedReason: "beta" })).toBeNull();
});

it.each([
  [2, "casual", 1200],
  [2, "club", 1375],
  [2, "strong", 1825],
  [3, "casual", 1275],
  [3, "club", 1375],
  [3, "strong", 1775],
  [4, "casual", 1225],
  [4, "club", 1400],
  [4, "strong", 1625],
] as const)(
  "keeps version %s %s receipts fixed at %s through forfeit, reload and undo",
  (version, level, rating) => {
    let s = reduceSession(freshSession(0, "prior"), {
      type: "new",
      id: "fixed-receipt",
      now: 0,
      setup: {
        playerColor: "w",
        level,
        time: "none",
        opponent:
          version === 2
            ? ratedMorphyConfig(4)
            : version === 3
              ? historicalMorphyConfig(4)
              : plannedMorphyConfig(4),
      },
    });
    s = move(s, "e4");
    const hinted = reduceSession(s, { type: "hint" });
    expect(settlePriorGame(hinted, 3).rating.games).toBe(0);
    const ended = settlePriorGame(s, 3);
    expect(ended.rating.history.at(-1)).toMatchObject({ oppRating: rating, score: 0 });
    const reloaded = parseSavedState(ended)!;
    expect(reloaded).toEqual(ended);
    expect(settlePriorGame(reloaded, 4).rating).toEqual(ended.rating);
    expect(settleRating(reloaded, 4).rating.games).toBe(1);
    expect(parseGameRecord(archiveGame(reloaded))).toMatchObject({
      rated: true,
      opponent: { version },
    });
    expect(reduceSession(reloaded, { type: "undo", now: 5 }).rating).toEqual(s.rating);
  },
);
it("rates only exact measured historical configurations", () => {
  const config = historicalMorphyConfig(7);
  expect(isRatedOpponent(config)).toBe(true);
  for (const change of [
    { version: 4 },
    { engine: "style-v1" },
    { randomPolicy: "ambient-v1" },
    { seed: null },
  ])
    expect(isRatedOpponent({ ...config, ...change })).toBe(false);
});

it("rates only exact measured planned configurations", () => {
  const config = plannedMorphyConfig(7);
  expect(isRatedOpponent(config)).toBe(true);
  for (const change of [
    { version: 5 },
    { engine: "historical-v1" },
    { randomPolicy: "ambient-v1" },
    { seed: null },
  ])
    expect(isRatedOpponent({ ...config, ...change })).toBe(false);
});
