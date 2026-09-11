import { expect, it } from "vitest";
import {
  archiveGame,
  updateArchive,
  replayRecord,
  rivalryKey,
  rivalrySummary,
} from "../../src/game/archive";
import { freshSession, reduceSession, settlePriorGame } from "../../src/game/state";
import { legalMoves } from "../../src/engine/board";
import { morphyConfig } from "../../src/engine/opponents";
import { parseGameRecord } from "../../src/account/records";

function completed(id = "one", now = 100) {
  let s = freshSession(now, id);
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now });
  return reduceSession(s, { type: "resign", now: now + 1 });
}
it("records assisted abandonment at completion time without changing its rating", () => {
  let s = freshSession(100, "assisted");
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 101 });
  s = reduceSession(s, { type: "hint" });
  const ended = settlePriorGame(s, 200);
  expect(archiveGame(ended)).toMatchObject({
    reason: "Abandoned",
    assisted: true,
    rated: false,
    completedAt: new Date(200).toISOString(),
  });
  expect(ended.rating).toEqual(s.rating);
});
it("archives metadata and legally replays without changing receipts or the live session", () => {
  const s = completed(),
    before = structuredClone(s),
    record = archiveGame(s)!;
  expect(record).toMatchObject({ recordVersion: 2, time: "none", assisted: false, rated: true });
  expect(record.completedAt).toBe(new Date(101).toISOString());
  const replay = replayRecord(record)!;
  expect(replay.positions).toHaveLength(2);
  expect(replay.positions.at(-1)).toEqual(s.game.st);
  expect(s).toEqual(before);
  expect(replayRecord({ ...record, moves: ["e5"] })).toBeNull();
  expect(replayRecord({ ...record, moves: ["f3", "e5", "g4", "Qh4#", "a3"] })).toBeNull();
  expect(parseGameRecord({ ...record, moves: Array(501).fill("e4") })).toBeNull();
  expect(parseGameRecord({ ...record, time: "invalid" })).toBeNull();
  expect(parseGameRecord({ ...record, time: ["none"] })).toBeNull();
  expect(parseGameRecord({ ...record, id: "x".repeat(257) })?.id).toHaveLength(257);
});
it("keeps only 200 unique retained games and revises terminal undo/recompletion", () => {
  const a = completed();
  let records = updateArchive([], a);
  expect(updateArchive(records, a)).toEqual(records);
  const undone = reduceSession(a, { type: "undo", now: 102 });
  expect(updateArchive(records, undone)).toEqual([]);
  const played = reduceSession(undone, {
    type: "move",
    move: legalMoves(undone.game.st)[0],
    book: false,
    now: 103,
  });
  const done = reduceSession(played, { type: "resign", now: 104 });
  records = updateArchive(records, done);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ assisted: true, rated: false });
  const template = archiveGame(a)!;
  const many = Array.from({ length: 205 }, (_, i) => ({
    ...template,
    id: String(i),
    completedAt: new Date(i * 1000).toISOString(),
  }));
  expect(updateArchive(many, completed("last", 300000))).toHaveLength(200);
  expect(updateArchive(many, completed("last", 300000))[0].id).toBe("last");
});
it("groups comparable difficulty/version but not random seeds, separating assistance and perspective", () => {
  const base = {
    ...archiveGame(completed())!,
    opponent: morphyConfig(1),
    rated: false,
    unratedReason: "beta" as const,
  };
  const next = {
    ...base,
    id: "next",
    opponent: morphyConfig(2),
    result: "1-0" as const,
    playerColor: "b" as const,
    assisted: true,
  };
  expect(rivalryKey(base)).toBe(rivalryKey(next));
  expect(rivalryKey({ ...base, level: "strong" })).not.toBe(rivalryKey(base));
  expect(rivalryKey({ ...base, opponent: { ...base.opponent, version: 2 } })).not.toBe(
    rivalryKey(base),
  );
  expect(
    rivalrySummary([base, next, { ...base, id: "draw", result: "½-½", assisted: null }], base),
  ).toEqual({
    total: 3,
    unassisted: { wins: 0, draws: 0, losses: 1 },
    assisted: { wins: 0, draws: 0, losses: 1 },
    unknown: { wins: 0, draws: 1, losses: 0 },
  });
});
