import type { Game } from "./types";

export function unratedDescription(game: Game): string {
  switch (game.unratedReason) {
    case "beta":
      return "Unrated beta — opponent calibration pending.";
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
