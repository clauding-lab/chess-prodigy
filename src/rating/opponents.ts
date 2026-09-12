import type { Level } from "../engine/types";
import { isSupportedOpponent, opponentName, type OpponentConfig } from "../engine/opponents";
import { ENGINE_ELO, LEVEL_LABEL } from "./fide";
// Immutable calibration for attack-development/version 2, style-v1.
export const MORPHY_RATINGS: Readonly<Record<Level, number>> = Object.freeze({
  casual: 1200,
  club: 1375,
  strong: 1825,
});
export function opponentPracticeRating(opponent: OpponentConfig, level: Level): number | null {
  if (!isSupportedOpponent(opponent)) return null;
  if (opponent.id === "classic") return ENGINE_ELO[level];
  return opponent.version === 2 ? MORPHY_RATINGS[level] : null;
}
export function opponentRatingLabel(
  opponent: OpponentConfig,
  level: Level,
  abandoned = false,
): string {
  return (
    (opponent.id === "classic"
      ? LEVEL_LABEL[level]
      : `${opponentName(opponent)} · ${LEVEL_LABEL[level]}`) + (abandoned ? " (abandoned)" : "")
  );
}
