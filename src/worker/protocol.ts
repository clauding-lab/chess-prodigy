import type { Position, Level, SearchResult, AiResult } from "../engine/types";
import type { ReviewPolicy, ReviewResult } from "../engine/reviewer";
import type { OpponentConfig } from "../engine/opponents";
export type EngineTask =
  | { type: "search"; depth: number; ms: number }
  | { type: "analyse"; reviewer: string; policy: ReviewPolicy; history: string[] }
  | { type: "ai"; level: Level; bookSans: string[]; opponent: OpponentConfig; ply: number };
export type RequestInput = EngineTask & { gameId: string; revision: number; position: Position };
export type EngineRequest = RequestInput & { requestId: number };
export type EngineResult = SearchResult | AiResult | ReviewResult;
export type EngineReply = {
  requestId: number;
  gameId: string;
  revision: number;
  type: EngineTask["type"];
} & ({ ok: true; result: EngineResult } | { ok: false; message: string });
