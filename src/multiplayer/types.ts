import type { Color, Move, Position } from "../engine/types";
import type { Game, GameResult } from "../game/types";
export interface MultiplayerRating {
  rating: number;
  games: number;
}
export interface MultiplayerPlayer extends MultiplayerRating {
  id: string;
  name: string;
}
export interface HeadToHead {
  opponent: MultiplayerPlayer;
  wins: number;
  losses: number;
  draws: number;
}
export interface MultiplayerGame {
  id: string;
  revision: number;
  status: "waiting" | "active" | "completed" | "cancelled" | "expired";
  creatorId: string;
  white: MultiplayerPlayer | null;
  black: MultiplayerPlayer | null;
  yourColor: Color | null;
  position: Position;
  moves: { move: Move; san: string }[];
  result: GameResult | null;
  drawOfferBy: string | null;
  createdAt: number;
  expiresAt: number;
  turnStartedAt: number | null;
  ratingChanges: { white: number; black: number } | null;
  headToHead: HeadToHead | null;
  /** Available only after completion, for the existing coaching/review interface. */
  review: Game | null;
}
export interface MultiplayerList {
  games: MultiplayerGame[];
  rating: MultiplayerRating;
  opponents: HeadToHead[];
}
export interface MultiplayerLeaderboard {
  players: { rank: number; name: string; rating: number; games: number }[];
}
export type InviteColor = Color | "random";
export type DrawAction = "offer" | "accept" | "decline";
