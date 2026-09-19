import book from "../../book/spassky-book.json";
import { applyMove, kingSq } from "../board";
import { centralBreak, enemy, features, home } from "./features";
import { explainMove, type Policy } from "./policy";
import type { ChooseRosterMove } from "./types";
export const spasskyPolicy: Policy = {
  loss: 100,
  cap: 240,
  prepare(p) {
    const before = features(p, p.turn),
      buildup = before.nonPawn >= 1300 && before.homeMinors > 0;
    const ready = !buildup && before.nonPawn >= 1300 && before.safeKing;
    const central = ready && [3, 4].includes(kingSq(p.board, enemy(p.turn)) & 7);
    const attack = ready && !central;
    return {
      plan: buildup
        ? "buildup"
        : central
          ? "open-centre"
          : attack
            ? "decisive-attack"
            : "central-activation",
      bonus(m) {
        const after = features(applyMove(p, m), p.turn),
          kind = p.board[m.from]![1];
        if (buildup)
          return (
            (before.homeMinors - after.homeMinors) * 160 +
            (m.castle ? 180 : 0) -
            (kind === "q" ? 100 : 0) -
            ("nb".includes(kind) && m.from >> 3 !== home(p.turn) ? 70 : 0) +
            (after.lines - before.lines) * 4
          );
        const least = Math.min(
          ...[...before.mobility.entries()]
            .filter(([s]) => "bnr".includes(p.board[s]![1]))
            .map(([, n]) => n),
        );
        const improve =
          before.mobility.get(m.from) === least
            ? Math.max(0, (after.mobility.get(m.to) ?? 0) - least) * 12
            : 0;
        return (
          (centralBreak(p, m, before, after) ? (central ? 240 : 195) : 0) +
          improve +
          (after.lines - before.lines) * 7 +
          (after.bishops - before.bishops) * 7 +
          (attack
            ? (after.attackers - before.attackers) * 150 + (after.area - before.area) * 10
            : 0)
        );
      },
    };
  },
};
export const explainSpasskyMove = (...args: Parameters<ChooseRosterMove>) =>
  explainMove(args[0], args[1], args[2], args[3], book, spasskyPolicy, args[4]);
export const chooseSpasskyMove: ChooseRosterMove = (...args) => explainSpasskyMove(...args).result;
