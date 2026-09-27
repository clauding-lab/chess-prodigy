import { applyMove, sameMove, sanFor } from "../engine/board";
import { MOTIFS } from "./motifs";
import { isNeutralEvaluation, reviewComplete, reviewHistoryIdentities } from "../engine/reviewer";
import type { AnnotatableEntry, PositionEval } from "./types";

export type { AnnotatableEntry, PositionEval } from "./types";

export function annotateAll<
  T extends { hist: AnnotatableEntry[]; evals: Record<number, PositionEval> },
>(game: T): T {
  let changed = false;
  const histories = reviewHistoryIdentities(game);
  const hist = game.hist.map((entry, ply) => {
    const before = game.evals[ply];
    const qualified =
      isNeutralEvaluation(before, entry.before, histories[ply], "review-v2") &&
      reviewComplete(before);
    const update = (ann: string | null, better: string | null = null) => {
      if (entry.ann === ann && entry.better === better) return entry;
      changed = true;
      return { ...entry, ann, better };
    };
    if (!qualified) return update(null);
    const multiplier = entry.before.turn === "w" ? 1 : -1;
    const played = before.review.alternatives.find(({ move }) => sameMove(move, entry.mv));
    if (!played) return update(null);
    const best = before.review.alternatives.reduce((a, b) =>
      multiplier * b.score > multiplier * a.score ? b : a,
    );
    const drop = multiplier * (best.score - played.score);
    let ann = "";
    if (drop >= 250) ann = "??";
    else if (drop >= 120) ann = "?";
    else if (drop >= 50) ann = "?!";
    else if (
      best.move &&
      sameMove(entry.mv, best.move) &&
      entry.motifs.some(({ key }) => MOTIFS[key].kind === "tactic" && key !== "check")
    )
      ann = "!";
    let better: string | null = null;
    if (ann && ann !== "!" && best.move && !sameMove(best.move, entry.mv))
      better = sanFor(entry.before, best.move, applyMove(entry.before, best.move));
    return update(ann, better);
  });
  return changed ? { ...game, hist } : game;
}
