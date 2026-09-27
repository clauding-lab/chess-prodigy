import { createHash } from "node:crypto";
import {
  START,
  applyMove,
  fromFEN,
  inCheck,
  legalMoves,
  posKey,
  sanFor,
  toFEN,
} from "../../src/engine/board";
import type { RosterGame } from "../roster-history/corpus";
import { replayRosterGame } from "../roster-history/corpus";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export type Split = "development" | "validation";
export type Mode = "fixed-completed-policy" | "production-elapsed";
export const SPLIT_SEED = "e0-20260927-whole-games-v1";
export const SEEDS = { development: [317, 9029], validation: [19471, 78157] } as const;
export interface Sample {
  id: string;
  gameId: string;
  split: Split;
  fen: string;
  key: string;
  ply: number;
  history: string[];
  tags: string[];
}
// Canonical game identity deliberately ignores source-specific IDs/player color.
export const wholeGameId = (moves: string[]) => digest(moves.join(" "));
export function splitFor(gameId: string): Split {
  return parseInt(digest(`${SPLIT_SEED}:${gameId}`).slice(0, 8), 16) % 5 === 0
    ? "validation"
    : "development";
}
export function positionTags(fen: string): string[] {
  const p = fromFEN(fen),
    moves = legalMoves(p);
  const tags = [p.turn === "w" ? "white-to-move" : "black-to-move"];
  if (inCheck(p, p.turn)) tags.push("in-check");
  if (moves.length === 1) tags.push("only-legal-move");
  if (p.board.filter(Boolean).length <= 10) tags.push("low-material");
  if (p.fullmove <= 10) tags.push("opening");
  return tags;
}
/** Replay entire games before sampling. Every shared key, even unsampled ones, is
 * quarantined from BOTH splits. Clocks ignored, castling/legal en passant retained. */
export function buildDataset(games: RosterGame[], stride = 12) {
  if (!Number.isInteger(stride) || stride < 1) throw Error("Invalid sampling stride");
  const seenGames = new Set<string>(),
    owners = new Map<string, Set<Split>>();
  const candidates: Sample[] = [];
  for (const game of [...games].sort((a, b) =>
    wholeGameId(a.moves).localeCompare(wholeGameId(b.moves)),
  )) {
    const gameId = wholeGameId(game.moves);
    if (seenGames.has(gameId)) continue;
    seenGames.add(gameId);
    const split = splitFor(gameId),
      history: string[] = [];
    let p = START();
    const moves = replayRosterGame(game);
    for (let ply = 0; ply <= moves.length; ply++) {
      const key = posKey(p),
        splits = owners.get(key) ?? new Set<Split>();
      splits.add(split);
      owners.set(key, splits);
      if (
        ply >= 12 &&
        (ply % stride === 0 || ply % stride === 1) &&
        legalMoves(p).length &&
        p.halfmove < 100
      ) {
        const fen = toFEN(p);
        candidates.push({
          id: `${gameId}:${ply}`,
          gameId,
          split,
          fen,
          key,
          ply,
          history: [...history],
          tags: positionTags(fen),
        });
      }
      if (ply < moves.length) {
        const next = applyMove(p, moves[ply]);
        history.push(sanFor(p, moves[ply], next));
        p = next;
      }
    }
  }
  const seenPositions = new Set<string>();
  const samples = candidates.filter((s) => {
    if (owners.get(s.key)!.size !== 1 || seenPositions.has(s.key)) return false;
    seenPositions.add(s.key);
    return true;
  });
  return {
    games: seenGames.size,
    quarantinedKeys: [...owners.values()].filter((s) => s.size > 1).length,
    samples,
  };
}
export type ChoiceClass = "forced-legal" | "genuine-choice" | "single-credible" | "uncertain";
/** Registered before results: 30 cp is a narrow evaluation equivalence window.
 * This shallow classification is a proxy, never a certificate of tactical safety. */
export function classifyChoice(
  legalCount: number,
  scores: number[],
  completedDepth: number,
): ChoiceClass {
  if (legalCount === 1) return "forced-legal";
  if (completedDepth < 2 || scores.length !== legalCount || scores.some((x) => !Number.isFinite(x)))
    return "uncertain";
  const sorted = [...scores].sort((a, b) => b - a);
  if (Math.abs(sorted[0]) >= 99900) return "uncertain";
  return sorted.filter((s) => sorted[0] - s <= 30).length >= 2
    ? "genuine-choice"
    : "single-credible";
}
export interface AgreementRow {
  sampleId: string;
  level: string;
  seed: number;
  mode: Mode;
  opponent: string;
  move: string;
  choice: ChoiceClass;
}
export function agreement(rows: AgreementRow[]) {
  const groups = new Map<string, AgreementRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.sampleId, row.level, row.seed, row.mode]);
    const group = groups.get(key) ?? [];
    if (group.some((r) => r.opponent === row.opponent)) throw Error("Duplicate benchmark cell");
    group.push(row);
    groups.set(key, group);
  }
  let equal = 0,
    pairs = 0,
    choiceEqual = 0,
    choicePairs = 0;
  for (const group of groups.values()) {
    if (group.length !== 6) throw Error("Incomplete six-opponent cell");
    if (new Set(group.map((r) => r.choice)).size !== 1)
      throw Error("Inconsistent choice classification");
    for (let a = 0; a < group.length; a++)
      for (let b = a + 1; b < group.length; b++) {
        pairs++;
        equal += Number(group[a].move === group[b].move);
        if (group[a].choice === "genuine-choice") {
          choicePairs++;
          choiceEqual += Number(group[a].move === group[b].move);
        }
      }
  }
  return {
    pairs,
    equal,
    rate: pairs ? equal / pairs : null,
    choicePairs,
    choiceEqual,
    choiceRate: choicePairs ? choiceEqual / choicePairs : null,
  };
}
export function assertMode(mode: string): asserts mode is Mode {
  if (mode !== "fixed-completed-policy" && mode !== "production-elapsed")
    throw Error("Unknown benchmark mode");
}
