import book from "../../book/tal-book.json";
import { applyMove, inCheck, legalMoves } from "../board";
import { centralBreak, enemy, features, offeredMaterial, value } from "./features";
import { explainMove, type Policy } from "./policy";
import type { ChooseRosterMove } from "./types";
export const talPolicy: Policy = {
  loss: 150,
  cap: 360,
  prepare(p) {
    const before = features(p, p.turn),
      attack = before.nonPawn >= 1000 && (before.attackers > 0 || before.exposure >= 2);
    return {
      plan: attack ? "forcing-initiative" : "mobilize-attack",
      bonus(m) {
        const next = applyMove(p, m),
          after = features(next, p.turn),
          check = inCheck(next, enemy(p.turn));
        const coordination = Math.max(0, after.attackers - before.attackers),
          access = Math.max(0, after.area - before.area),
          exposure = Math.max(0, after.exposure - before.exposure);
        const offered = offeredMaterial(p, m);
        const acceptedOffers =
          offered > 0
            ? legalMoves(next).filter((reply) => {
                if (reply.to !== m.to || !reply.capture) return false;
                const taken = applyMove(next, reply);
                const recapture = legalMoves(taken).some((r) => r.to === reply.to && r.capture);
                return (
                  value[next.board[m.to]![1]] -
                    value[m.capture?.[1] ?? "k"] -
                    (recapture ? value[next.board[reply.from]![1]] : 0) >
                  0
                );
              })
            : [];
        // Assess the position after accepting an offer: the vacated pawn shield and
        // surviving legal attackers matter, not the rook that is about to disappear.
        const compensation =
          acceptedOffers.length > 0 &&
          acceptedOffers.every((reply) => {
            const accepted = features(applyMove(next, reply), p.turn);
            return accepted.attackers >= 2 && accepted.exposure > before.exposure;
          });
        if (offered > 0 && !compensation) return 0;
        const offer = attack && compensation;
        const retain = before.attackers >= 2 && after.attackers < before.attackers ? -60 : 0;
        return (
          (before.homeMinors - after.homeMinors) * 85 +
          (m.castle ? 95 : 0) +
          (attack
            ? coordination * 170 +
              access * 14 +
              exposure * 65 +
              (check && after.attackers >= 2 ? 70 : 0) +
              (offer ? 160 : 0) +
              retain
            : 0) +
          (centralBreak(p, m, before, after) ? 95 : 0) +
          (after.lines - before.lines) * 5
        );
      },
    };
  },
};
export const explainTalMove = (...args: Parameters<ChooseRosterMove>) =>
  explainMove(args[0], args[1], args[2], args[3], book, talPolicy, args[4]);
export const chooseTalMove: ChooseRosterMove = (...args) => explainTalMove(...args).result;
