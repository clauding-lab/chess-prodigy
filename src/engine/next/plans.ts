import { applyMove, fromFEN, inCheck, kingSq } from "../board";
import { centralBreak, enemy, features, pawnSupported, type Features } from "../roster/features";
import type { Move, Position } from "../types";
export type ExperimentId = "tal" | "fischer";
export type PlanId =
  | "tal-mobilize"
  | "tal-king-pressure"
  | "fischer-develop"
  | "fischer-weak-pawn"
  | "fischer-file-pressure"
  | "fischer-convert";
export interface ExperimentPlan {
  id: PlanId;
  targetFile: number | null;
  sincePly: number;
  epoch: number;
}
const weakPawnFiles = (p: Position) => [
  ...new Set(
    p.board.flatMap((piece, sq) =>
      piece === `${enemy(p.turn)}p` && !pawnSupported(p, enemy(p.turn), sq) ? [sq & 7] : [],
    ),
  ),
];
function select(id: ExperimentId, p: Position, ply: number, epoch: number): ExperimentPlan {
  const f = features(p, p.turn);
  if (id === "tal")
    return {
      id:
        f.nonPawn >= 1000 && (f.attackers >= 1 || f.exposure >= 2)
          ? "tal-king-pressure"
          : "tal-mobilize",
      targetFile: kingSq(p.board, enemy(p.turn)) & 7,
      sincePly: ply,
      epoch,
    };
  if (f.homeMinors > 0) return { id: "fischer-develop", targetFile: null, sincePly: ply, epoch };
  if (f.material >= 100 && f.nonPawn <= 1800)
    return { id: "fischer-convert", targetFile: null, sincePly: ply, epoch };
  const weak = weakPawnFiles(p);
  if (weak.length) return { id: "fischer-weak-pawn", targetFile: weak[0], sincePly: ply, epoch };
  const files = Array.from({ length: 8 }, (_, file) => file).filter(
    (file) => !p.board.some((piece, sq) => piece === `${p.turn}p` && (sq & 7) === file),
  );
  return { id: "fischer-file-pressure", targetFile: files[0] ?? null, sincePly: ply, epoch };
}
function viable(plan: ExperimentPlan, p: Position, f: Features): boolean {
  if (plan.id.startsWith("tal-")) {
    if (plan.targetFile !== (kingSq(p.board, enemy(p.turn)) & 7)) return false;
    return plan.id === "tal-king-pressure"
      ? f.nonPawn >= 1000 && (f.attackers >= 1 || f.exposure >= 2)
      : !(f.nonPawn >= 1000 && (f.attackers >= 1 || f.exposure >= 2));
  }
  if (plan.id === "fischer-develop") return f.homeMinors > 0;
  if (f.homeMinors > 0) return false;
  if (plan.id === "fischer-convert") return f.material >= 100 && f.nonPawn <= 1800;
  if (f.material >= 100 && f.nonPawn <= 1800) return false;
  if (plan.id === "fischer-weak-pawn") return weakPawnFiles(p).includes(plan.targetFile!);
  return (
    plan.targetFile === null ||
    !p.board.some((piece, sq) => piece === `${p.turn}p` && (sq & 7) === plan.targetFile)
  );
}
/** Six-own-turn epochs bound history work; reconstruction never persists a hidden mutable plan. */
export function deriveExperimentPlan(
  id: ExperimentId,
  position: Position,
  history: readonly string[],
): ExperimentPlan {
  const epoch = Math.floor(history.length / 12) * 12;
  let plan: ExperimentPlan | null = null;
  for (let ply = epoch; ply <= history.length; ply++) {
    const p = ply === history.length ? position : fromFEN(history[ply]);
    if (p.turn !== position.turn) continue;
    if (!plan || !viable(plan, p, features(p, p.turn))) plan = select(id, p, ply, epoch);
  }
  return plan!;
}
/** Goal progress is secondary to exact neutral safety; this never widens the loss allowance. */
export function rankExperimentMove(p: Position, move: Move, plan: ExperimentPlan): number {
  const before = features(p, p.turn),
    next = applyMove(p, move),
    after = features(next, p.turn),
    kind = p.board[move.from]![1];
  const develop = (before.homeMinors - after.homeMinors) * 75 + (move.castle ? 85 : 0);
  let gain = develop;
  switch (plan.id) {
    case "tal-mobilize":
      gain +=
        Math.max(0, after.attackers - before.attackers) * 65 +
        (centralBreak(p, move, before, after) ? 55 : 0);
      break;
    case "tal-king-pressure":
      gain +=
        Math.max(0, after.attackers - before.attackers) * 95 +
        Math.max(0, after.area - before.area) * 12 +
        Math.max(0, after.exposure - before.exposure) * 45 +
        (centralBreak(p, move, before, after) ? 65 : 0) +
        (inCheck(next, enemy(p.turn)) && after.attackers >= 2 ? 35 : 0) -
        (after.attackers < before.attackers ? 70 : 0);
      break;
    case "fischer-develop":
      gain -= kind === "q" ? 55 : 0;
      break;
    case "fischer-weak-pawn":
      gain +=
        Math.max(0, after.pressure - before.pressure) * 65 +
        ((move.to & 7) === plan.targetFile && kind === "r" ? 45 : 0) +
        (move.capture === `${enemy(p.turn)}p` && (move.to & 7) === plan.targetFile ? 70 : 0);
      break;
    case "fischer-file-pressure":
      gain +=
        Math.max(0, after.files - before.files) * 55 +
        ((move.to & 7) === plan.targetFile && kind === "r" ? 55 : 0);
      break;
    case "fischer-convert":
      if (after.material >= before.material)
        gain +=
          Math.max(0, after.passed - before.passed) * 18 +
          (kind === "k" ? Math.max(0, after.kingActivity - before.kingActivity) * 40 : 0) +
          (move.capture && kind !== "p" ? 35 : 0);
      break;
  }
  return Math.max(0, Math.min(150, gain));
}
