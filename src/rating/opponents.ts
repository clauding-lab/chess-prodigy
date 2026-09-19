import type { RosterId } from "../engine/roster/types";
import type { Level } from "../engine/types";
import {
  isRosterId,
  isSupportedOpponent,
  opponentName,
  type OpponentConfig,
} from "../engine/opponents";
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
// Immutable calibration for chigorin/version 1, chigorin-plans-v1.
export const CHIGORIN_RATINGS: Readonly<Record<Level, number>> = Object.freeze({
  casual: 1250,
  club: 1350,
  strong: 1625,
});
// Independently accepted calibration for the historical roster, version 1 / plans-v1.
export const ROSTER_RATINGS: Readonly<Record<RosterId, Readonly<Record<Level, number>>>> =
  Object.freeze({
    spassky: Object.freeze({ casual: 1150, club: 1325, strong: 1700 }),
    tal: Object.freeze({ casual: 1200, club: 1325, strong: 1700 }),
    fischer: Object.freeze({ casual: 1250, club: 1350, strong: 1675 }),
  });
export function opponentPracticeRating(opponent: OpponentConfig, level: Level): number | null {
  if (!isSupportedOpponent(opponent)) return null;
  if (isRosterId(opponent.id)) return ROSTER_RATINGS[opponent.id]?.[level] ?? null;
  if (opponent.id === "classic") return ENGINE_ELO[level];
  if (opponent.id === "chigorin") return CHIGORIN_RATINGS[level];
  if (opponent.id !== "attack-development") return null;
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
