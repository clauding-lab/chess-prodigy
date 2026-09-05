import { applyMove, sameMove, sanFor } from "../engine/board";
import { MOTIFS } from "./motifs";
import type { AnnotatableEntry, PositionEval } from "./types";

export type { AnnotatableEntry, PositionEval } from "./types";

export function annotateAll<
  T extends { hist: AnnotatableEntry[]; evals: Record<number, PositionEval> },
>(game: T): T {
  let changed = false;
  const hist = game.hist.map((entry, ply) => {
    if (entry.ann !== null) return entry;
    const before = game.evals[ply],
      after = game.evals[ply + 1];
    if (!before || !after) return entry;
    changed = true;
    const multiplier = entry.before.turn === "w" ? 1 : -1;
    const moverBefore = multiplier * before.score,
      moverAfter = multiplier * after.score;
    if (entry.book) return { ...entry, ann: "book" };
    if (Math.abs(moverBefore) > 3000 || Math.abs(moverAfter) > 3000) return { ...entry, ann: "" };
    const drop = moverBefore - moverAfter;
    let ann = "";
    if (drop >= 250) ann = "??";
    else if (drop >= 120) ann = "?";
    else if (drop >= 50) ann = "?!";
    else if (
      before.best &&
      sameMove(entry.mv, before.best) &&
      entry.motifs.some(({ key }) => MOTIFS[key].kind === "tactic" && key !== "check")
    )
      ann = "!";
    let better: string | null = null;
    if (ann && ann !== "!" && before.best && !sameMove(before.best, entry.mv))
      better = sanFor(entry.before, before.best, applyMove(entry.before, before.best));
    return { ...entry, ann, better };
  });
  return changed ? { ...game, hist } : game;
}
