import { expect, it } from "vitest";
import { parseRecordsEnvelope } from "../../src/account/records";
import { CLASSIC, morphyConfig } from "../../src/engine/opponents";

it("migrates retained legacy archives to Classic without inventing assistance or beta wins", () => {
  const old = {
    id: "old",
    result: "1-0",
    reason: "Checkmate",
    level: "club",
    playerColor: "w",
    rated: false,
    moves: ["e4"],
    completedAt: "2026-09-11T00:00:00+06:00",
  };
  const parsed = parseRecordsEnvelope({
    version: 7,
    snapshot: null,
    games: [old, { ...old, id: "rated", rated: true }],
    updatedAt: null,
  })!;
  expect(parsed.games[0]).toEqual({
    ...old,
    recordVersion: 2,
    opponent: CLASSIC,
    unratedReason: "legacy-unrated",
    assisted: null,
  });
  expect(parsed.games[1]).toMatchObject({
    opponent: CLASSIC,
    unratedReason: null,
    assisted: false,
  });
  expect(parseRecordsEnvelope(parsed)).toEqual(parsed);
  expect(
    parseRecordsEnvelope({ ...parsed, games: [{ ...parsed.games[1], opponent: morphyConfig(1) }] }),
  ).toBeNull();
});
