/// <reference lib="webworker" />
import { search, chooseAiMove } from "./search";
import type { EngineRequest, EngineReply } from "../worker/protocol";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (event: MessageEvent<EngineRequest>) => {
  const r = event.data;
  try {
    const result =
      r.type === "ai"
        ? chooseAiMove(r.position, r.level, r.bookSans)
        : search(r.position, r.depth, r.ms);
    const reply: EngineReply = {
      requestId: r.requestId,
      gameId: r.gameId,
      revision: r.revision,
      ok: true,
      result,
    };
    scope.postMessage(reply);
  } catch (error) {
    const reply: EngineReply = {
      requestId: r.requestId,
      gameId: r.gameId,
      revision: r.revision,
      ok: false,
      message: error instanceof Error ? error.message : "Engine calculation failed",
    };
    scope.postMessage(reply);
  }
};
