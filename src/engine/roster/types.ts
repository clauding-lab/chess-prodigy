import type { AiResult, Level, Position } from "../types";
export type RosterId = "spassky" | "tal" | "fischer";
export type RosterBook = Readonly<Record<string, readonly (string | number)[][]>>;
export type ChooseRosterMove = (
  position: Position,
  level: Level,
  seed: number,
  ply: number,
  now?: () => number,
) => AiResult;
export interface RosterDecision {
  result: AiResult;
  plan: string;
  depth: number;
  neutralLoss: number;
  bonus: number;
  reason: "book" | "terminal" | "mate" | "plan" | "neutral" | "incomplete" | "deadline";
}
