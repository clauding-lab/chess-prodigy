import { searchNextShortlistReuse } from "../../engine/next/shortlist-reuse-search";
import { NEXT_BUDGETS, NEXT_WORKER_POLICY, type NextRequest, type NextReply } from "./protocol";
self.onmessage = ({ data: request }: MessageEvent<NextRequest>) => {
  const identity = {
    requestId: request.requestId,
    gameId: request.gameId,
    revision: request.revision,
  };
  let reply: NextReply;
  try {
    if (request.policy !== NEXT_WORKER_POLICY || !Object.hasOwn(NEXT_BUDGETS, request.level))
      throw new Error("Experimental policy is unavailable.");
    const result = searchNextShortlistReuse(request.position, request.history, {
      maxDepth: 8,
      ms: NEXT_BUDGETS[request.level],
      candidateWindowCp: 100,
      forcingSafetyPlies: 12,
    });
    reply = { ...identity, ok: true, result };
  } catch {
    reply = { ...identity, ok: false, message: "Experimental calculation failed." };
  }
  self.postMessage(reply);
};
