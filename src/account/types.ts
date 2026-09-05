import type { Session } from "../game/types";

export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export interface GameRecord {
  id: string;
  result: "1-0" | "0-1" | "½-½";
  reason: string;
  level: "casual" | "club" | "strong";
  playerColor: "w" | "b";
  rated: boolean;
  moves: string[];
  completedAt: string;
}

export interface RecordsEnvelope {
  version: number;
  snapshot: Session | null;
  games: GameRecord[];
  updatedAt: string | null;
}

export interface LeaderboardPlayer {
  rank: number;
  name: string;
  rating: number;
  games: number;
}
