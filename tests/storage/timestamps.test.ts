import { expect, it } from "vitest";
import { freshSession } from "../../src/game/state";
import { parseSavedState } from "../../src/storage/schema";
import { defaultRating, ratingUpdate } from "../../src/rating/fide";
import { archiveGame } from "../../src/game/archive";

it.each([8_640_000_000_000_000, Number.MAX_SAFE_INTEGER, -1, NaN, Infinity])(
  "rejects unsafe clock timestamp %s before any date arithmetic",
  (clockAt) => {
    const session = freshSession(0, "boundary");
    session.game.clockAt = clockAt;
    expect(() => parseSavedState(session)).not.toThrow();
    expect(parseSavedState(session)).toBeNull();
  },
);
it("keeps BDT rating formatting and archival total for invalid direct inputs", () => {
  const session = freshSession(0, "boundary");
  session.game.over = { result: "0-1", reason: "Resignation" };
  session.game.clockAt = Number.MAX_SAFE_INTEGER;
  expect(() => archiveGame(session)).not.toThrow();
  expect(archiveGame(session)).toBeNull();
  expect(() =>
    ratingUpdate(defaultRating(), 1350, 0, { opp: "Classic" }, Number.MAX_SAFE_INTEGER),
  ).not.toThrow();
});
it("round trips the last supported four-digit BDT date", () => {
  const now = Date.parse("9999-12-31T17:59:59.999Z");
  const session = freshSession(now, "last-date");
  expect(parseSavedState(session)).not.toBeNull();
  expect(ratingUpdate(defaultRating(), 1350, 0, { opp: "Classic" }, now).next.history[0].date).toBe(
    "9999-12-31",
  );
  session.game.clockAt++;
  expect(parseSavedState(session)).toBeNull();
});

it("preserves epoch-day receipts reconstructed from BDT midnight before epoch", async () => {
  const { playLine, FOOLS_MATE } = await import("../game/play-line");
  const ended = playLine(freshSession(0, "epoch-receipt"), FOOLS_MATE, 1);
  expect(ended.rating.history[0].date).toBe("1970-01-01");
  expect(parseSavedState(ended)).toEqual(ended);
});
