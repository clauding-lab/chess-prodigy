import talBook from "../../book/tal-book.json";
import fischerBook from "../../book/fischer-book.json";
import { decideExperiment } from "../../engine/next/roster";
import type { ExperimentRequest } from "./experiment-protocol";
self.onmessage = ({ data: request }: MessageEvent<ExperimentRequest>) => {
  const identity = {
    requestId: request.requestId,
    gameId: request.gameId,
    revision: request.revision,
  };
  try {
    const result = decideExperiment(
      request.position,
      request.history,
      request.opponent,
      request.level,
      request.opponent.id === "tal" ? talBook : fischerBook,
      {
        remainingMs:
          request.turnDeadline === null
            ? undefined
            : Math.max(0, request.turnDeadline - Date.now()),
      },
    );
    self.postMessage({ ...identity, ok: true, result });
  } catch {
    self.postMessage({ ...identity, ok: false, message: "Experimental calculation failed." });
  }
};
