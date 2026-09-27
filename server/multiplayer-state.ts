import type { Game } from "../src/game/types.js";
import { isOpponentConfig, isSupportedOpponent } from "../src/engine/opponents.js";
import { defaultRating } from "../src/rating/fide.js";
import { parseSavedState } from "../src/storage/schema.js";

export class MultiplayerStateError extends Error {
  readonly status = 409;
  constructor() {
    super(
      "This saved game is unavailable. Its data is preserved for recovery; please contact support.",
    );
  }
}

/** Human games used the v1.2 Game shape before opponent metadata existed.
 * Validate with the same bounded legal replay as local saves, while keeping human
 * results separate from computer-game rating receipts. Reads never rewrite rows.
 */
export function readMultiplayerState(raw: string): Game {
  try {
    if (raw.length > 2_000_000) throw new MultiplayerStateError();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new MultiplayerStateError();
    const game = value as Record<string, unknown>;
    if (
      !Array.isArray(game.hist) ||
      game.hist.length > 2000 ||
      !game.setup ||
      typeof game.setup !== "object" ||
      (game.setup as Record<string, unknown>).playerColor !== "w" ||
      (game.setup as Record<string, unknown>).level !== "club" ||
      (game.setup as Record<string, unknown>).time !== "none" ||
      game.rated !== true ||
      game.hintUsed !== false ||
      game.ratingApplied !== null ||
      !game.evals ||
      Object.keys(game.evals).length !== 0
    )
      throw new MultiplayerStateError();
    const legacy =
      !Object.hasOwn(game, "opponent") &&
      !Object.hasOwn(game, "unratedReason") &&
      !Object.hasOwn(game, "takebackUsed");
    if (
      !legacy &&
      (!isOpponentConfig(game.opponent) ||
        !isSupportedOpponent(game.opponent) ||
        game.opponent.id !== "classic" ||
        game.unratedReason !== null ||
        game.takebackUsed !== false)
    )
      throw new MultiplayerStateError();
    const over = game.over;
    if (
      over !== null &&
      (!over ||
        typeof over !== "object" ||
        Array.isArray(over) ||
        !["1-0", "0-1", "½-½"].includes(String((over as Record<string, unknown>).result)) ||
        typeof (over as Record<string, unknown>).reason !== "string" ||
        ![
          "Checkmate",
          "Stalemate",
          "Insufficient material",
          "Threefold repetition",
          "Fifty-move rule",
          "Resignation",
          "Draw by agreement",
        ].includes(String((over as Record<string, unknown>).reason)))
    )
      throw new MultiplayerStateError();
    // Human Elo is stored in mp_ratings, not Game.ratingApplied. Exclude only
    // that result/receipt invariant while validating all positions and history.
    const session = parseSavedState(
      {
        version: legacy ? 1 : 2,
        game: { ...game, over: null },
        rating: defaultRating(),
        preferences: { theme: "dark", sound: true, coach: true, flipped: false },
      },
      { preserveDerived: true },
    );
    if (!session) throw new MultiplayerStateError();
    return { ...session.game, over: over as Game["over"] };
  } catch {
    throw new MultiplayerStateError();
  }
}
