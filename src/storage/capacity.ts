// The automatic 100-half-move rule plus at most 126 pawn/capture resets
// bounds a legal game by 12,700 half moves. This is a processing ceiling,
// never a new rule that awards a draw or truncates a game.
export const MAX_GAME_PLIES = 12_800;
export const MAX_COMPACT_BYTES = 2 * 1024 * 1024;
