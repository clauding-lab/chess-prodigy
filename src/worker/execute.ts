import { search } from "../engine/search";
import { chooseOpponentMove } from "../engine/morphy";
import { REVIEWER, reviewPosition } from "../engine/reviewer";
import type { EngineRequest, EngineResult } from "./protocol";

export function executeEngineRequest(request: EngineRequest, now?: () => number): EngineResult {
  if (request.type === "ai")
    return chooseOpponentMove(
      request.position,
      request.level,
      request.bookSans,
      request.opponent,
      request.ply,
      now,
    );
  if (request.type === "analyse") {
    if (request.reviewer !== REVIEWER) throw new Error("Reviewer version is unavailable.");
    return reviewPosition(request.position, request.history, request.policy, now);
  }
  return search(request.position, request.depth, request.ms, now);
}
