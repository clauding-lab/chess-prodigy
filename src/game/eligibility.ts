import { isRosterId, isExperimentalOpponent } from "../engine/opponents";
import type { Game } from "./types";

export function unratedDescription(game: Game): string {
  switch (game.unratedReason) {
    case "beta":
      return isExperimentalOpponent(game.opponent)
        ? "Unrated experiment — strength and personality are still being tested."
        : isRosterId(game.opponent.id)
          ? "Unrated beta — this game keeps its original unrated status."
          : "Unrated beta — this opponent predates rated Morphy.";
    case "hint":
      return "Unrated game (hint used).";
    case "takeback":
      return "Unrated game (takeback used).";
    case "engine-interrupted":
      return "Unrated game — computer execution was interrupted before its clock expired.";
    case "temporary-session":
      return "Unrated temporary game — progress is lost when this tab closes.";
    case "rating-reset":
      return "Unrated game (rating reset).";
    default:
      return "Unrated game (legacy eligibility).";
  }
}
