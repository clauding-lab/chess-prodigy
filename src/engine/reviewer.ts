import { insufficientMaterial, legalMoves, sameMove, toFEN } from "./board";
import { searchRootCandidates } from "./search";
import type { Move, Position, SearchResult } from "./types";
import type { PositionEval } from "../coach/types";

// Replace this adapter/version when the reviewer changes. Opponent configuration
// is deliberately absent: neutrality is separation, not a strength claim.
export const REVIEWER = "custom-neutral-v2";
export const REVIEW_POLICIES = {
  "review-v2": { depth: 3, ms: 180 },
  "hint-v1": { depth: 4, ms: 900 },
} as const;
export type ReviewPolicy = keyof typeof REVIEW_POLICIES;
export interface ReviewProvenance {
  purpose: "neutral-review";
  reviewer: typeof REVIEWER;
  policy: ReviewPolicy;
  position: string;
  history: string;
  depth: number;
  perspective: "white";
  completion: "complete" | "incomplete";
  alternatives: { move: Move; score: number }[];
}
export type ReviewResult = SearchResult & { review: ReviewProvenance };

// A bounded, non-security cache fingerprint avoids repeating an entire history
// in every saved evaluation. Full FEN keeps clock/rule state out of repetition keys.
export function historyIdentity(history: readonly string[]): string {
  return hashText(0xcbf29ce484222325n, JSON.stringify(history)).toString(16).padStart(16, "0");
}

function hashText(hash: bigint, text: string): bigint {
  for (const character of text) {
    hash ^= BigInt(character.charCodeAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash;
}

export function reviewHistoryIdentities(game: { hist: { before: Position }[] }): string[] {
  let prefix = hashText(0xcbf29ce484222325n, "[");
  const identities = [hashText(prefix, "]").toString(16).padStart(16, "0")];
  for (const [ply, entry] of game.hist.entries()) {
    prefix = hashText(prefix, `${ply ? "," : ""}${JSON.stringify(toFEN(entry.before))}`);
    identities.push(hashText(prefix, "]").toString(16).padStart(16, "0"));
  }
  return identities;
}

export function reviewHistory(game: { hist: { before: Position }[] }, ply: number): string[] {
  return game.hist.slice(0, ply).map((entry) => toFEN(entry.before));
}

export function reviewPosition(
  position: Position,
  history: readonly string[],
  policy: ReviewPolicy = "review-v2",
  now?: () => number,
): ReviewResult {
  if (!Object.hasOwn(REVIEW_POLICIES, policy)) throw new Error("Review policy is unavailable.");
  const config = REVIEW_POLICIES[policy];
  const root = searchRootCandidates(position, config.depth, config.ms, now);
  const result = root.fallback;
  return {
    ...result,
    review: {
      purpose: "neutral-review",
      reviewer: REVIEWER,
      policy,
      position: toFEN(position),
      history: historyIdentity(history),
      depth: result.depth,
      perspective: "white",
      completion: root.depth > 0 || result.move === null ? "complete" : "incomplete",
      alternatives: root.candidates.map(({ move, score }) => ({
        move,
        score: score * (position.turn === "w" ? 1 : -1),
      })),
    },
  };
}

// Cached moves are untrusted: coordinate equality alone does not validate the
// flags consumed by applyMove/sanFor (castling, en passant and captures).
function sameReviewMove(candidate: Move | null | undefined, canonical: Move): boolean {
  return (
    !!candidate &&
    typeof candidate === "object" &&
    !Array.isArray(candidate) &&
    sameMove(candidate, canonical) &&
    candidate.capture === canonical.capture &&
    candidate.ep === canonical.ep &&
    candidate.double === canonical.double &&
    candidate.castle === canonical.castle
  );
}

export function isNeutralEvaluation(
  value: PositionEval | undefined,
  position: Position,
  history: readonly string[] | string,
  policy?: ReviewPolicy,
): value is PositionEval & { review: ReviewProvenance } {
  const r = value?.review;
  if (
    !value ||
    !Number.isFinite(value.score) ||
    !r ||
    typeof r !== "object" ||
    r.purpose !== "neutral-review" ||
    r.reviewer !== REVIEWER ||
    typeof r.policy !== "string" ||
    !Object.hasOwn(REVIEW_POLICIES, r.policy) ||
    (policy && r.policy !== policy) ||
    r.position !== toFEN(position) ||
    r.history !== (typeof history === "string" ? history : historyIdentity(history)) ||
    r.perspective !== "white" ||
    !["complete", "incomplete"].includes(r.completion) ||
    !Array.isArray(r.alternatives) ||
    !Number.isInteger(r.depth) ||
    r.depth < 0 ||
    r.depth > REVIEW_POLICIES[r.policy].depth
  )
    return false;
  const moves = legalMoves(position);
  if (r.alternatives.some((a) => !a || !a.move || !Number.isFinite(a.score))) return false;
  if (
    r.depth > 0 &&
    (r.completion !== "complete" ||
      r.alternatives.length !== moves.length ||
      moves.some((move) => r.alternatives.filter((a) => sameReviewMove(a.move, move)).length !== 1))
  )
    return false;
  if (r.depth === 0 && r.alternatives.length) return false;
  return value.best === null
    ? !moves.length || position.halfmove >= 100 || insufficientMaterial(position.board)
    : moves.some((move) => sameReviewMove(value.best, move));
}

export function reviewComplete(value: PositionEval): boolean {
  const r = value.review;
  return !!r && r.completion === "complete" && (r.depth > 0 || value.best === null);
}

export function reusableReview(
  value: PositionEval | undefined,
  position: Position,
  history: readonly string[],
): boolean {
  return isNeutralEvaluation(value, position, history, "review-v2") && reviewComplete(value);
}
