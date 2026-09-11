import { describe, it, expect } from "vitest";
import { freshGame, reduceGame, freshSession, reduceSession } from "../../src/game/state";
import { legalMoves, sanFor, applyMove } from "../../src/engine/board";
import { defaultRating, ratingUpdate, kFactor, expectedScore } from "../../src/rating/fide";
import type { Game, Setup } from "../../src/game/types";
const setup: Setup = { playerColor: "w", level: "club", time: "5+0" };
function move(g: Game, san: string, now: number) {
  const m = legalMoves(g.st).find((m) => sanFor(g.st, m, applyMove(g.st, m)) === san)!;
  return reduceGame(g, { type: "move", move: m, book: false, now });
}
describe("clock and game transitions", () => {
  it("charges delayed time before accepting a late move", () => {
    const g = { ...freshGame(setup, 0, "one"), started: true, clocks: { w: 1000, b: 1000 } };
    const m = legalMoves(g.st).find((m) => m.from === 52 && m.to === 36)!;
    const next = reduceGame(g, { type: "move", move: m, book: false, now: 1500 });
    expect(next.hist).toHaveLength(0);
    expect(next.over?.reason).toBe("Time out");
  });
  it("charges outgoing colour and awards increment exactly once", () => {
    let g = freshGame({ ...setup, time: "15+10" }, 0, "one");
    g = move(g, "e4", 1000);
    expect(g.clocks?.w).toBe(910000);
    g = move(g, "e5", 2500);
    expect(g.clocks).toEqual({ w: 910000, b: 908500 });
  });
  it("rejects stale evaluations even at the same ply", () => {
    const g = freshGame(setup, 0, "new");
    expect(
      reduceGame(g, {
        type: "evaluation",
        gameId: "old",
        revision: 0,
        ply: 0,
        value: { score: 999, best: null },
      }),
    ).toBe(g);
  });
  it("undo voids game and restores both pre-turn clocks", () => {
    let g = freshGame(setup, 0, "one");
    g = move(g, "e4", 1000);
    g = move(g, "e5", 2000);
    const undone = reduceGame(g, { type: "undo", now: 3000 });
    expect(undone.hist).toHaveLength(0);
    expect(undone.rated).toBe(false);
    expect(undone.clocks).toEqual({ w: 300000, b: 300000 });
  });
});
describe("rating settlement", () => {
  it("settles a finished game once and reverses only its receipt on undo", () => {
    let s = freshSession(0, "one");
    const m = legalMoves(s.game.st).find((m) => m.from === 52 && m.to === 36)!;
    s = reduceSession(s, { type: "move", move: m, book: false, now: 1 });
    s = reduceSession(s, { type: "resign", now: 2 });
    expect(s.rating.games).toBe(1);
    s = reduceSession(s, { type: "tick", now: 3 });
    expect(s.rating.games).toBe(1);
    s = reduceSession(s, { type: "undo", now: 4 });
    expect(s.rating.games).toBe(0);
    expect(s.game.rated).toBe(false);
  });
  it("hints and abandonment apply the intended rating policy", () => {
    let s = freshSession(0, "one");
    const m = legalMoves(s.game.st)[0];
    s = reduceSession(s, { type: "move", move: m, book: false, now: 1 });
    const abandoned = reduceSession(s, { type: "new", setup, now: 2, id: "two" });
    expect(abandoned.rating.games).toBe(1);
    s = reduceSession(s, { type: "hint" });
    expect(reduceSession(s, { type: "new", setup, now: 2, id: "two" }).rating.games).toBe(0);
  });
  it("keeps K ladder, cap and actual floor delta; dates are BDT", () => {
    expect(kFactor(defaultRating())).toBe(40);
    expect(kFactor({ ...defaultRating(), games: 30 })).toBe(20);
    expect(kFactor({ ...defaultRating(), reached2400: true })).toBe(10);
    expect(expectedScore(1400, 900)).toBe(expectedScore(1400, 1000));
    const r = ratingUpdate(
      defaultRating(),
      900,
      0,
      { opp: "Casual" },
      Date.parse("2026-09-04T19:00:00Z"),
    );
    expect(r.delta).toBe(0);
    expect(r.next.history[0].date).toBe("2026-09-05");
  });
});

describe("scoped bare-king timeout", () => {
  it.each([
    ["4k3/8/8/8/8/8/8/3QK3 w - - 0 1", "w"],
    ["3qk3/8/8/8/8/8/8/4K3 b - - 0 1", "b"],
  ] as const)(
    "draws when the side with material flags against a bare king: %s",
    async (fen, side) => {
      const { fromFEN } = await import("../../src/engine/board");
      let s = freshSession(0, "bare-king");
      s.game = {
        ...freshGame({ ...setup, playerColor: side }, 0, "bare-king"),
        st: fromFEN(fen),
        started: true,
        clocks: { w: 1000, b: 1000 },
      };
      s = reduceSession(s, { type: "tick", now: 1500 });
      expect(s.game.over?.result).toBe("½-½");
      expect(s.game.over?.reason).toMatch(/Time out/);
      expect(s.rating.history.at(-1)?.score).toBe(0.5);
      const receipt = s.game.ratingApplied;
      expect(reduceSession(s, { type: "tick", now: 3000 }).game.ratingApplied).toBe(receipt);
      expect(
        reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 3000 })
          .game.hist,
      ).toHaveLength(0);
    },
  );

  it("preserves established timeout wins when the opponent has other material", async () => {
    const { fromFEN } = await import("../../src/engine/board");
    const g = {
      ...freshGame(setup, 0, "not-bare"),
      started: true,
      clocks: { w: 1, b: 1000 },
      st: fromFEN("4kb2/8/8/8/8/8/8/3QK3 w - - 0 1"),
    };
    expect(reduceGame(g, { type: "tick", now: 2 }).over).toEqual({
      result: "0-1",
      reason: "Time out",
    });
  });
});
