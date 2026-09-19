import book from "../../book/fischer-book.json";
import { applyMove } from "../board";
import { features, home, value } from "./features";
import { explainMove, type Policy } from "./policy";
import type { ChooseRosterMove } from "./types";
export const fischerPolicy: Policy = {
  loss: 50,
  cap: 240,
  prepare(p) {
    const before = features(p, p.turn),
      convert = before.material >= 100 && before.nonPawn <= 1300;
    return {
      plan: convert ? "favorable-conversion" : "sustained-pressure",
      bonus(m, score) {
        const after = features(applyMove(p, m), p.turn),
          kind = p.board[m.from]![1];
        const development =
          (before.homeMinors - after.homeMinors) * 110 +
          (m.castle ? 130 : 0) -
          (before.homeMinors > 0 && kind === "q" ? 85 : 0) -
          ("bn".includes(kind) && m.from >> 3 !== home(p.turn) && before.homeMinors > 0 ? 30 : 0);
        if (convert) {
          const favorable =
            score >= 80 && after.material >= before.material && after.attackers >= before.attackers;
          const trade =
            favorable && m.capture && kind !== "p" && value[kind] <= value[m.capture[1]] + 30
              ? 100
              : 0;
          return (
            development +
            trade +
            Math.max(0, after.passed - before.passed) * 28 +
            (kind === "k" ? Math.max(0, after.kingActivity - before.kingActivity) * 75 : 0) +
            (after.files - before.files) * 35
          );
        }
        return (
          development +
          (after.bishops - before.bishops) * 22 +
          (after.files - before.files) * 100 +
          (after.pressure - before.pressure) * 105 +
          (after.lines - before.lines) * 5
        );
      },
    };
  },
};
export const explainFischerMove = (...args: Parameters<ChooseRosterMove>) =>
  explainMove(args[0], args[1], args[2], args[3], book, fischerPolicy, args[4]);
export const chooseFischerMove: ChooseRosterMove = (...args) => explainFischerMove(...args).result;
