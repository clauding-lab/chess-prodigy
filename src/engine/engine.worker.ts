/// <reference lib="webworker" />
import { executeEngineRequest } from "../worker/execute";
import type { EngineRequest, EngineReply } from "../worker/protocol";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<EngineRequest>) => {
  const r = event.data;
  try {
    const result = executeEngineRequest(r);
    const reply: EngineReply = {
      requestId: r.requestId,
      gameId: r.gameId,
      revision: r.revision,
      type: r.type,
      ok: true,
      result,
    };
    scope.postMessage(reply);
  } catch (error) {
    const reply: EngineReply = {
      requestId: r.requestId,
      gameId: r.gameId,
      revision: r.revision,
      type: r.type,
      ok: false,
      message: error instanceof Error ? error.message : "Engine calculation failed",
    };
    scope.postMessage(reply);
  }
};
