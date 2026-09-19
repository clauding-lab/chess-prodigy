/// <reference lib="webworker" />
import { isRosterOpponent } from "../opponents";
import type { ChooseRosterMove, RosterId } from "./types";
import type { EngineRequest, EngineReply, EngineResult } from "../../worker/protocol";
export function executeRosterRequest(
  id: RosterId,
  choose: ChooseRosterMove,
  request: EngineRequest,
  now?: () => number,
): EngineResult {
  if (request.type !== "ai" || request.opponent.id !== id || !isRosterOpponent(request.opponent))
    throw new Error("Opponent worker identity is unavailable.");
  return choose(request.position, request.level, request.opponent.seed!, request.ply, now);
}
export function installRosterWorker(id: RosterId, choose: ChooseRosterMove): void {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  scope.onmessage = (event: MessageEvent<EngineRequest>) => {
    const r = event.data;
    const identity = {
      requestId: r.requestId,
      gameId: r.gameId,
      revision: r.revision,
      type: r.type,
    };
    let reply: EngineReply;
    try {
      reply = { ...identity, ok: true, result: executeRosterRequest(id, choose, r) };
    } catch (error) {
      reply = {
        ...identity,
        ok: false,
        message: error instanceof Error ? error.message : "Engine calculation failed",
      };
    }
    scope.postMessage(reply);
  };
}
