import { expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { playLine, FOOLS_MATE } from "../game/play-line";
import { encodeCompactSession, decodeCompactSession } from "../../src/storage/compact";
import { parseSavedState } from "../../src/storage/schema";
import { MAX_GAME_PLIES } from "../../src/storage/capacity";

it("round trips legal history, clocks, metadata and exact terminal receipt without board copies", () => {
  let source = freshSession(0, "compact-mate");
  source.game.setup.time = "15+10";
  source.game.clocks = { w: 900000, b: 900000 };
  source = playLine(source, FOOLS_MATE, 1000);
  const encoded = encodeCompactSession(source);
  expect(encoded.version).toBe(3);
  expect(encoded.game).not.toHaveProperty("hist");
  expect(encoded.game).not.toHaveProperty("st");
  const decoded = decodeCompactSession(encoded)!;
  expect(parseSavedState(decoded)).toEqual(source);
  expect(decoded.game.ratingApplied).toEqual(source.game.ratingApplied);
});
it("rebuilds repetition counts after a takeback transposition", () => {
  let source = playLine(freshSession(0, "transpose"), ["e4", "e5", "Nf3", "Nc6"]);
  source = reduceSession(source, { type: "undo", now: 2 });
  source = reduceSession(source, { type: "undo", now: 3 });
  source = playLine(source, ["Nf3", "e5", "e4"], 4);
  const decoded = decodeCompactSession(encodeCompactSession(source))!;
  expect(parseSavedState(decoded)?.game.hist).toEqual(source.game.hist);
  expect(Object.values(decoded.game.keys).every((count) => count > 0)).toBe(true);
});
it("rejects malformed and excessive move input before replay", () => {
  const encoded = encodeCompactSession(freshSession(0, "safe"));
  for (const moves of [
    null,
    [null],
    [[99, 0, null, null, null, false]],
    Array(MAX_GAME_PLIES + 1).fill(null),
  ]) {
    expect(() =>
      decodeCompactSession({ ...encoded, game: { ...encoded.game, moves } }),
    ).not.toThrow();
    expect(decodeCompactSession({ ...encoded, game: { ...encoded.game, moves } })).toBeNull();
  }
});
it("does not confuse an illegal move or unknown compact version with an empty save", () => {
  const encoded = encodeCompactSession(freshSession(0, "safe"));
  expect(decodeCompactSession({ ...encoded, version: 4 })).toBeNull();
  expect(
    decodeCompactSession({
      ...encoded,
      game: { ...encoded.game, moves: [[0, 32, null, null, null, false]] },
    }),
  ).toBeNull();
});

it.each([240, 250, 501])(
  "supports a legal reviewed %s-half-move game without cached review payload",
  async (plies) => {
    const { longGame } = await import("./long-game");
    const source = longGame(plies, true);
    for (let i = 0; i < 572; i++) source.game.keys[`obsolete-${i}`] = 0;
    expect(parseSavedState(source)).not.toBeNull();
    const encoded = encodeCompactSession(source);
    const oldBytes = new TextEncoder().encode(JSON.stringify(source)).length;
    const newBytes = new TextEncoder().encode(JSON.stringify(encoded)).length;
    expect(newBytes).toBeLessThan(oldBytes / 4);
    expect(newBytes).toBeLessThan(2 * 1024 * 1024);
    const decoded = decodeCompactSession(encoded)!;
    expect(decoded.game.hist.map((entry) => entry.san)).toEqual(
      source.game.hist.map((entry) => entry.san),
    );
    expect(decoded.game.opponent).toEqual(source.game.opponent);
    expect(decoded.game.ratingApplied).toEqual(source.game.ratingApplied);
    expect(decoded.rating).toEqual(source.rating);
    expect(decoded.game.evals).toEqual({});
  },
);

it("rejects sparse arrays and malformed scalar metadata before legal reconstruction", async () => {
  const { vi } = await import("vitest");
  const board = await import("../../src/engine/board");
  const encoded = encodeCompactSession(freshSession(0, "bounded"));
  expect(() =>
    decodeCompactSession({ ...encoded, game: { ...encoded.game, moves: Array(1) } }),
  ).not.toThrow();
  const spy = vi.spyOn(board, "legalMoves");
  try {
    for (const patch of [
      { rating: null },
      { preferences: {} },
      { game: { ...encoded.game, revision: -1 } },
      { game: { ...encoded.game, opponent: null } },
      { game: { ...encoded.game, clocks: { w: Infinity, b: 0 } } },
    ]) {
      const value = { ...encoded, ...patch };
      value.game = { ...value.game, moves: Array(100).fill([52, 36, null, null, null, false]) };
      expect(decodeCompactSession(value)).toBeNull();
    }
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});

it.each([
  ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"],
  ["e4", "a6", "e5", "d5", "exd6"],
  ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "bxa8=Q"],
  ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "bxa8=N"],
])("round trips special move line %j", (...line) => {
  const source = playLine(freshSession(0, "special"), line);
  expect(decodeCompactSession(encodeCompactSession(source))).toEqual(source);
});

it("retains every supported opponent identity, assistance and exact receipts", async () => {
  const {
    CLASSIC,
    morphyConfig,
    ratedMorphyConfig,
    historicalMorphyConfig,
    plannedMorphyConfig,
    chigorinConfig,
    rosterConfig,
  } = await import("../../src/engine/opponents");
  for (const opponent of [
    CLASSIC,
    morphyConfig(7),
    ratedMorphyConfig(7),
    historicalMorphyConfig(7),
    plannedMorphyConfig(7),
    chigorinConfig(7),
    ...(["spassky", "tal", "fischer"] as const).map((id) => rosterConfig(id, 7)),
  ]) {
    for (const assisted of [false, true]) {
      let source = reduceSession(freshSession(0, "old"), {
        type: "new",
        id: "identity",
        now: 0,
        setup: { playerColor: "w", level: "club", time: "none", opponent },
      });
      source = playLine(source, ["e4"]);
      if (assisted) source = reduceSession(source, { type: "hint" });
      source = reduceSession(source, { type: "resign", now: 2 });
      expect(decodeCompactSession(encodeCompactSession(source))).toEqual(source);
    }
  }
});

it("rejects continuations after an automatic draw without truncating the supplied moves", () => {
  const source = playLine(freshSession(0, "draw"), [
    "Nf3",
    "Nf6",
    "Ng1",
    "Ng8",
    "Nf3",
    "Nf6",
    "Ng1",
    "Ng8",
  ]);
  const encoded = encodeCompactSession(source);
  encoded.game.moves.push([52, 36, null, null, null, false]);
  expect(decodeCompactSession(encoded)).toBeNull();
  expect(encoded.game.moves).toHaveLength(9);
});

it("rejects UTF-8 overflow and mixed/null or nonfinite clocks", () => {
  const encoded = encodeCompactSession(freshSession(0, "safe"));
  expect(decodeCompactSession({ ...encoded, extra: "😀".repeat(600000) })).toBeNull();
  for (const clocks of [
    [null, 1],
    [1, null],
    [Infinity, 1],
    [-1, 0],
  ]) {
    expect(
      decodeCompactSession({
        ...encoded,
        game: { ...encoded.game, moves: [[52, 36, null, ...clocks, false]] },
      }),
    ).toBeNull();
  }
});
