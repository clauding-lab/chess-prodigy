import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves, toFEN } from "../../src/engine/board";
import { REVIEWER, reviewHistoryIdentities } from "../../src/engine/reviewer";

export function longGame(plies: number, reviewed = false) {
  let session = freshSession(0, `legal-${plies}`),
    random = 17;
  for (let ply = 0; ply < plies; ply++) {
    const priority = (move: ReturnType<typeof legalMoves>[number]) =>
      move.capture
        ? 3
        : session.game.st.halfmove > 35
          ? session.game.st.board[move.from]?.[1] === "p"
            ? 0
            : 1
          : session.game.st.board[move.from]?.[1] === "p"
            ? 2
            : 0;
    const candidates = legalMoves(session.game.st)
      .map((move) => {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        return { move, rank: random };
      })
      .sort((a, b) => priority(a.move) - priority(b.move) || a.rank - b.rank);
    const next = candidates
      .map(({ move }) => reduceSession(session, { type: "move", move, book: false, now: ply + 1 }))
      .find((candidate) => !candidate.game.over);
    if (!next) throw Error(`Cannot continue fixture at ${ply}`);
    session = next;
  }
  if (reviewed) {
    const histories = reviewHistoryIdentities(session.game);
    for (let ply = 0; ply <= session.game.hist.length; ply++) {
      const position = session.game.hist[ply]?.before ?? session.game.st;
      session.game.evals[ply] = {
        score: 0,
        best: legalMoves(position)[0] ?? null,
        review: {
          purpose: "neutral-review",
          reviewer: REVIEWER,
          policy: "review-v1",
          depth: 3,
          position: toFEN(position),
          history: histories[ply],
        },
      };
    }
  }
  return reduceSession(session, { type: "resign", now: plies + 1 });
}
