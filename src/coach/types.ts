import type { Color, Move, Position } from "../engine/types";

export const MOTIF_KEYS = [
  "fork",
  "pin",
  "skewer",
  "discovered",
  "doublecheck",
  "backrank",
  "sacrifice",
  "gambit",
  "castle",
  "castleQ",
  "fianchetto",
  "duo",
  "iqp",
  "doubled",
  "passed",
  "outpost",
  "openfile",
  "seventh",
  "bishops",
  "pawnbreak",
  "minority",
  "opposition",
  "activeking",
  "enpassant",
  "promotion",
  "underpromotion",
  "check",
] as const;

export type MotifKey = (typeof MOTIF_KEYS)[number];
export type MotifKind = "tactic" | "development" | "positional" | "endgame" | "rule";

export interface MotifCard {
  name: string;
  kind: MotifKind;
  origin: string;
  plan: string;
}

export interface Motif {
  key: MotifKey;
  detail: string;
  side: Color;
}

export interface PositionEval {
  score: number;
  best: Move | null;
}

export interface AnnotatableEntry {
  san: string;
  mv: Move;
  before: Position;
  motifs: Motif[];
  book: boolean;
  ann: string | null;
  better: string | null;
}

export interface GameResultLike {
  result?: string;
  reason: string;
}
