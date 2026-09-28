import { expect, it } from "vitest";
import { freshGame, reduceGame } from "../../src/game/state";
import { fromFEN, applyMove, legalMoves, posKey, sanFor } from "../../src/engine/board";
import { experimentalRosterConfig, rosterConfig } from "../../src/engine/opponents";
for (const fen of ["7k/8/8/8/5p2/4B3/8/K1B5 w - - 0 1", "5b1k/8/3b4/2P5/8/8/8/K7 b - - 0 1"])
  it(`settles the new engine's bishop-only draw while preserving old game rules: ${fen}`, () => {
    const position = fromFEN(fen);
    for (const experimental of [true, false]) {
      const game = {
        ...freshGame(
          {
            playerColor: position.turn,
            level: "club",
            time: "none",
            opponent: experimental ? experimentalRosterConfig("tal", 1) : rosterConfig("tal", 1),
          },
          0,
          "endgame",
        ),
        st: position,
        keys: { [posKey(position)]: 1 },
      };
      const move = legalMoves(position).find((m) =>
        sanFor(position, m, applyMove(position, m)).startsWith("Bx"),
      )!;
      const next = reduceGame(game, { type: "move", move, book: false, now: 1 });
      expect(next.over).toEqual(
        experimental ? { result: "½-½", reason: "Insufficient material" } : null,
      );
    }
  });
