import type { Position, Level, SearchResult, AiResult } from "../engine/types";
export type EngineTask =
  | { type: "search" | "analyse"; depth: number; ms: number }
  | { type: "ai"; level: Level; bookSans: string[] };
export type RequestInput = EngineTask & { gameId: string; revision: number; position: Position };
export type EngineRequest = RequestInput & { requestId: number };
export type EngineResult = SearchResult | AiResult;
export type EngineReply = { requestId: number; gameId: string; revision: number } & (
  { ok: true; result: EngineResult } | { ok: false; message: string }
);
