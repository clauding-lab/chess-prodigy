import type { Color, Level, Move, Position } from "../engine/types";
import type { AnnotatableEntry, PositionEval } from "../coach/annotate";
import type { Rating } from "../rating/fide";
import type { OpponentConfig } from "../engine/opponents";
export type TimeControl = "none" | "5+0" | "10+0" | "15+10";
export interface Setup {
  playerColor: Color;
  level: Level;
  time: TimeControl;
  opponent?: OpponentConfig;
}
export interface Preferences {
  theme: "wood" | "dark";
  sound: boolean;
  coach: boolean;
  flipped: boolean;
}
export interface GameResult {
  result: "1-0" | "0-1" | "½-½";
  reason: string;
}
export interface RatingReceipt {
  gameId: string;
  before: Rating;
  delta: number;
  after: number;
}
export interface HistoryEntry extends AnnotatableEntry {
  keyAfter: string;
  clocksBefore: Clocks | null;
}
export type Clocks = Record<Color, number>;
export interface Game {
  id: string;
  revision: number;
  st: Position;
  hist: HistoryEntry[];
  keys: Record<string, number>;
  over: GameResult | null;
  setup: Setup;
  opponent: OpponentConfig;
  unratedReason: UnratedReason;
  takebackUsed: boolean | null;
  clocks: Clocks | null;
  clockAt: number;
  started: boolean;
  rated: boolean;
  hintUsed: boolean;
  ratingApplied: RatingReceipt | null;
  evals: Record<number, PositionEval>;
}
export interface Session {
  version: 2;
  game: Game;
  rating: Rating;
  preferences: Preferences;
}
export type UnratedReason = null | "beta" | "hint" | "takeback" | "rating-reset" | "legacy-unrated";
export type LegacySession = Omit<Session, "version" | "game"> & {
  version: 1;
  game: Omit<Game, "opponent" | "unratedReason" | "takebackUsed">;
};
export type Action =
  | { type: "move"; move: Move; book: boolean; now: number }
  | { type: "tick"; now: number }
  | { type: "undo"; now: number }
  | { type: "resign"; now: number }
  | { type: "hint" }
  | { type: "evaluation"; gameId: string; revision: number; ply: number; value: PositionEval };
export type SessionAction =
  | Action
  | { type: "forfeit"; now: number }
  | { type: "new"; setup: Setup; now: number; id: string }
  | { type: "preferences"; value: Partial<Preferences> }
  | { type: "resetRating" };
