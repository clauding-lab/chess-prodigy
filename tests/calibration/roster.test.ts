import { expect, test } from "vitest";
import { ROSTER_IDS, rosterConfig } from "../../src/engine/opponents";
import {
  parseProtocol,
  opponentIdentity,
  openingForProtocol,
  sourceFingerprints,
  assertExactSourceFingerprints,
} from "../../scripts/calibration/protocol";
import { playMatch, verifySavedMatch } from "../../scripts/calibration/match";
import { chooseRosterOpponentMove } from "../../src/engine/roster/dispatch";
import { executeRosterRequest } from "../../src/engine/roster/worker";
import { chooseSpasskyMove } from "../../src/engine/roster/spassky";
import { chooseTalMove } from "../../src/engine/roster/tal";
import { chooseFischerMove } from "../../src/engine/roster/fischer";
import { START } from "../../src/engine/board";
for (const id of ROSTER_IDS) {
  test(`${id} binds START, exact identity and same pure worker/Node choice`, () => {
    const protocol = parseProtocol(`${id}-plans-paired-v1`),
      identity = opponentIdentity(protocol);
    expect(identity).toEqual({
      id,
      version: 1,
      engine: `${id}-plans-v1`,
      randomPolicy: "seeded-per-ply-v1",
    });
    expect(openingForProtocol(protocol, 1)).toEqual([]);
    const options = {
      protocol,
      opponentVersion: 1 as const,
      level: "casual" as const,
      morphyColor: "w" as const,
      seed: 1,
      opening: [],
      maxPlies: 1,
    };
    const game = playMatch(options);
    expect(game.opponent).toEqual(rosterConfig(id, 1));
    expect(game.score).toBeNull();
    expect(() => verifySavedMatch(game, options)).not.toThrow();
    expect(() => playMatch({ ...options, opponentVersion: 4 })).toThrow(/version/);
    expect(() => playMatch({ ...options, opening: ["e4"] })).toThrow(/START/);
    expect(() =>
      verifySavedMatch(
        { ...game, opponent: rosterConfig(id === "tal" ? "fischer" : "tal", 1) },
        options,
      ),
    ).toThrow(/identity/);
    const position = START(),
      opponent = rosterConfig(id, 12),
      choose = { spassky: chooseSpasskyMove, tal: chooseTalMove, fischer: chooseFischerMove }[id];
    expect(chooseRosterOpponentMove(position, "casual", [], opponent, 0)).toEqual(
      executeRosterRequest(id, choose, {
        type: "ai",
        requestId: 1,
        gameId: id,
        revision: 0,
        position,
        opponent,
        level: "casual",
        ply: 0,
        bookSans: [],
      }),
    );
  });
  test(`${id} manifest binds every transitive roster book/helper and rejects altered/extra sources`, () => {
    const protocol = parseProtocol(`${id}-plans-paired-v1`),
      source = sourceFingerprints(protocol);
    for (const player of ROSTER_IDS) {
      expect(source[`src/book/${player}-book.json`]).toMatch(/^[a-f0-9]{64}$/);
      expect(source[`src/engine/roster/${player}.ts`]).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const file of ["book", "policy", "features", "dispatch", "worker", "types"])
      expect(source[`src/engine/roster/${file}.ts`]).toBeTruthy();
    expect(() => assertExactSourceFingerprints(source, protocol)).not.toThrow();
    expect(() =>
      assertExactSourceFingerprints(
        { ...source, [`src/book/${id}-book.json`]: "a".repeat(64) },
        protocol,
      ),
    ).toThrow(/mismatch/);
    expect(() =>
      assertExactSourceFingerprints({ ...source, "extra.ts": "a".repeat(64) }, protocol),
    ).toThrow(/set mismatch/);
  });
}
