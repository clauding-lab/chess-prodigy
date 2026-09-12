import type { Level } from "../engine/types";
import { isSupportedOpponent, opponentName, type OpponentConfig } from "../engine/opponents";
import { ENGINE_ELO, LEVEL_LABEL } from "./fide";
// Immutable calibration for attack-development/version 2, style-v1.
export const MORPHY_RATINGS: Readonly<Record<Level, number>> = Object.freeze({
  casual: 1200,
  club: 1375,
  strong: 1825,
});
// Immutable calibration for attack-development/version 3, historical-v1.
export const HISTORICAL_MORPHY_RATINGS: Readonly<Record<Level, number>> = Object.freeze({
  casual: 1275,
  club: 1375,
  strong: 1775,
});
// Immutable calibration for attack-development/version 4, plans-v1.
export const PLANNED_MORPHY_RATINGS: Readonly<Record<Level, number>> = Object.freeze({
  casual: 1225,
  club: 1400,
  strong: 1625,
});
export function opponentPracticeRating(opponent: OpponentConfig, level: Level): number | null {
  if (!isSupportedOpponent(opponent)) return null;
  if (opponent.id === "classic") return ENGINE_ELO[level];
  if (opponent.version === 2) return MORPHY_RATINGS[level];
  if (opponent.version === 3) return HISTORICAL_MORPHY_RATINGS[level];
  if (opponent.version === 4) return PLANNED_MORPHY_RATINGS[level];
  return null;
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
