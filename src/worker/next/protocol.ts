import { fromFEN, inCheck, legalMoves, posKey, toFEN } from "../../engine/board";
import { isDeadPositionV2 } from "../../engine/rules-v2";
import type { Level, Move, Position } from "../../engine/types";
import type { NextSearchResult } from "../../engine/next/shortlist-reuse-search";
export const NEXT_WORKER_POLICY = "next-neutral-shortlist-reuse-v1";
export const NEXT_BUDGETS = { casual: 200, club: 600, strong: 2000 } as const;
export interface NextInput {
  gameId: string;
  revision: number;
  position: Position;
  history: string[];
  policy: typeof NEXT_WORKER_POLICY;
  level: Level;
}
export type NextRequest = NextInput & { requestId: number };
export type NextResult = NextSearchResult;
export type NextReply = Pick<NextRequest, "requestId" | "gameId" | "revision"> &
  ({ ok: true; result: NextResult } | { ok: false; message: string });
export function nextHistoryIdentity(history: readonly string[]): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of JSON.stringify(history)) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
const moveKey = (move: Move) =>
  JSON.stringify([move.from, move.to, move.promo, move.capture, move.ep, move.double, move.castle]);
const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
/** Fail closed on unknown worker data; this validates provenance/shape, not chess optimality. */
export function isNextResult(value: unknown, request: NextRequest): value is NextResult {
  try {
    const r = value as NextResult;
    if (
      !r ||
      r.policy !== request.policy ||
      r.position !== toFEN(request.position) ||
      r.history !== nextHistoryIdentity(request.history) ||
      r.perspective !== "white" ||
      !natural(r.nodes) ||
      !natural(r.attemptedDepth) ||
      r.attemptedDepth > 8 ||
      !Number.isFinite(r.elapsedMs) ||
      r.elapsedMs < 0 ||
      ![null, "deadline", "nodes", "cancelled", "forcing-limit"].includes(r.interruption) ||
      r.settings.maxDepth !== 8 ||
      r.settings.candidateWindowCp !== 100 ||
      r.settings.forcingCapturePlies !== 4 ||
      r.settings.forcingSafetyPlies !== 12 ||
      r.settings.baselineOnly !== false ||
      !Array.isArray(r.candidates) ||
      !Array.isArray(r.iterations)
    )
      return false;
    const moves = legalMoves(request.position),
      key = posKey(request.position);
    const terminal = !moves.length
      ? inCheck(request.position, request.position.turn)
        ? "checkmate"
        : "stalemate"
      : request.position.halfmove >= 100
        ? "fifty-move-rule"
        : request.history.filter((fen) => posKey(fromFEN(fen)) === key).length >= 2
          ? "threefold-repetition"
          : isDeadPositionV2(request.position.board)
            ? "dead-position"
            : null;
    if (r.terminal !== terminal) return false;
    if (r.kind === "terminal")
      return (
        terminal !== null &&
        r.nodes === 0 &&
        r.attemptedDepth === 0 &&
        r.interruption === null &&
        r.move === null &&
        r.depth === 0 &&
        r.phase === null &&
        r.candidates.length === 0 &&
        r.iterations.length === 0 &&
        r.score ===
          (terminal === "checkmate" ? (request.position.turn === "w" ? -100000 : 100000) : 0)
      );
    if (terminal !== null) return false;
    if (r.kind === "incomplete")
      return (
        r.move === null &&
        r.score === null &&
        r.depth === 0 &&
        r.phase === null &&
        r.candidates.length === 0 &&
        r.iterations.length === 0 &&
        r.interruption !== null &&
        r.attemptedDepth === 2
      );
    if (
      r.kind !== "completed" ||
      !Number.isFinite(r.score) ||
      !natural(r.depth) ||
      r.depth < 2 ||
      r.depth > 8 ||
      r.attemptedDepth < r.depth ||
      !["baseline", "forcing"].includes(r.phase) ||
      (r.phase === "baseline" && r.depth !== 2) ||
      r.candidates.length !== moves.length
    )
      return false;
    const expectedCount = r.phase === "baseline" ? 1 : r.depth;
    if (
      r.iterations.length !== expectedCount ||
      !Array.from(r.iterations).every(
        (entry, index) =>
          entry.phase === (index === 0 ? "baseline" : "forcing") &&
          entry.depth === (index === 0 ? 2 : index + 1) &&
          natural(entry.nodes) &&
          entry.nodes <= r.nodes &&
          (index === 0 || entry.nodes >= r.iterations[index - 1].nodes),
      )
    )
      return false;
    if (r.interruption === null) {
      if (
        r.phase !== "forcing" ||
        r.depth !== 8 ||
        r.attemptedDepth !== 8 ||
        r.iterations.at(-1)!.nodes !== r.nodes
      )
        return false;
    } else if (r.attemptedDepth !== (r.phase === "baseline" ? 2 : r.depth + 1)) return false;
    const legal = new Set(moves.map(moveKey)),
      seen = new Set<string>(),
      sign = request.position.turn === "w" ? 1 : -1;
    for (const entry of r.candidates) {
      const key = moveKey(entry.move);
      if (
        !legal.has(key) ||
        seen.has(key) ||
        !Number.isFinite(entry.score) ||
        entry.depth !== r.depth
      )
        return false;
      seen.add(key);
      if (entry.kind === "exact") {
        if (entry.score * sign > r.score * sign) return false;
      } else if (
        r.phase === "baseline" ||
        entry.kind !== (sign === 1 ? "upper-bound" : "lower-bound") ||
        entry.score * sign >= r.score * sign - 100
      )
        return false;
    }
    return r.candidates.some(
      (entry) =>
        entry.kind === "exact" &&
        entry.score === r.score &&
        moveKey(entry.move) === moveKey(r.move),
    );
  } catch {
    return false;
  }
}
