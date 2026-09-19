import { isRosterId, opponentName } from "../engine/opponents";
import type { Game } from "./types";

export function unratedDescription(game: Game): string {
  switch (game.unratedReason) {
    case "beta":
      return isRosterId(game.opponent.id)
        ? `Unrated beta — ${opponentName(game.opponent)} strength measurement is not yet accepted.`
        : "Unrated beta — this opponent predates rated Morphy.";
    case "hint":
      return "Unrated game (hint used).";
    case "takeback":
      return "Unrated game (takeback used).";
    case "rating-reset":
      return "Unrated game (rating reset).";
    default:
      return "Unrated game (legacy eligibility).";
  }
}
