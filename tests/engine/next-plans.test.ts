import { expect, it } from "vitest";
import { START, applyMove, fromFEN, legalMoves, sanFor, toFEN } from "../../src/engine/board";
import { deriveExperimentPlan, rankExperimentMove } from "../../src/engine/next/plans";
function line(sans: string[]) {
  let position = START();
  const history: string[] = [];
  for (const san of sans) {
    history.push(toFEN(position));
    const move = legalMoves(position).find(
      (m) => sanFor(position, m, applyMove(position, m)) === san,
    )!;
    expect(move).toBeDefined();
    position = applyMove(position, move);
  }
  return { position, history };
}
it.each(["tal", "fischer"] as const)(
  "reconstructs a persistent %s development plan through multiple own turns",
  (id) => {
    for (const moves of [[], ["e4", "e5"], ["e4", "e5", "Nf3", "Nc6"]]) {
      const { position, history } = line(moves);
      const plan = deriveExperimentPlan(id, position, history);
      expect(plan.id).toBe(id === "tal" ? "tal-mobilize" : "fischer-develop");
      expect(plan.sincePly).toBe(0);
      expect(deriveExperimentPlan(id, position, [...history])).toEqual(plan);
    }
    const { position, history } = line(["e4", "e5", "Nf3"]);
    expect(deriveExperimentPlan(id, position, history).sincePly).toBe(1);
  },
);
function scenario(fen: string, sans: string[], black: boolean) {
  let original = fromFEN(fen),
    position = original;
  const flip = (sq: number) => (7 - (sq >> 3)) * 8 + (sq & 7);
  if (black)
    position = {
      ...original,
      turn: original.turn === "w" ? "b" : "w",
      board: original.board.map((_, sq) => {
        const piece = original.board[flip(sq)];
        return piece ? (`${piece[0] === "w" ? "b" : "w"}${piece[1]}` as typeof piece) : null;
      }),
      castling: {
        K: original.castling.k,
        Q: original.castling.q,
        k: original.castling.K,
        q: original.castling.Q,
      },
      ep: original.ep === null ? null : flip(original.ep),
    };
  const history: string[] = [];
  for (const san of sans) {
    const move = legalMoves(original).find(
      (m) => sanFor(original, m, applyMove(original, m)) === san,
    );
    expect(move, `legal source ${san}`).toBeDefined();
    const mapped = legalMoves(position).find(
      (m) =>
        m.from === (black ? flip(move!.from) : move!.from) &&
        m.to === (black ? flip(move!.to) : move!.to) &&
        m.promo === move!.promo,
    );
    expect(mapped, `legal transformed ${san}`).toBeDefined();
    history.push(toFEN(position));
    position = applyMove(position, mapped!);
    original = applyMove(original, move!);
  }
  return { position, history };
}
it.each([false, true])(
  "retains then abandons Fischer's pawn target along legal moves, black=%s",
  (black) => {
    const fen = "1r4k1/7p/8/8/8/8/8/R5K1 w - - 0 1";
    for (const sans of [[], ["Ra7", "Rb4"]]) {
      const s = scenario(fen, sans, black),
        plan = deriveExperimentPlan("fischer", s.position, s.history);
      expect(plan).toMatchObject({ id: "fischer-weak-pawn", targetFile: 7, sincePly: 0 });
    }
    const s = scenario(fen, ["Ra7", "Rb4", "Rxh7", "Rb8"], black);
    expect(deriveExperimentPlan("fischer", s.position, s.history).id).not.toBe("fischer-weak-pawn");
  },
);
it.each([false, true])(
  "releases Tal's target after legal queenside castling, black=%s",
  (black) => {
    const fen = "r3k3/ppp2ppp/8/8/8/1BQ5/8/6K1 w q - 0 1";
    const before = scenario(fen, [], black),
      after = scenario(fen, ["Qb2", "O-O-O"], black);
    expect(deriveExperimentPlan("tal", before.position, []).targetFile).toBe(4);
    expect(deriveExperimentPlan("tal", after.position, after.history)).toMatchObject({
      targetFile: 2,
      sincePly: 2,
    });
  },
);
it("prioritizes developing an idle minor while Fischer still has undeveloped pieces", () => {
  const p = START(),
    plan = deriveExperimentPlan("fischer", p, []),
    moves = legalMoves(p);
  const knight = moves.find((m) => m.from === 62 && m.to === 45)!,
    edge = moves.find((m) => m.from === 48 && m.to === 40)!;
  expect(rankExperimentMove(p, knight, plan)).toBeGreaterThan(rankExperimentMove(p, edge, plan));
});
