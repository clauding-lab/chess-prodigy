import { createHash } from "node:crypto";
import { applyMove, legalMoves, sanFor, START, toFEN } from "../../src/engine/board";
import { nextRootTerminal } from "../../src/worker/next/protocol";
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export interface FreezeSettings {
  purpose: "development" | "final";
  datasetSha: string;
  expectedCount: number;
  /** Digest of sources, books, worker bundles, settings and machine identity. */
  context: string;
  nonce: string;
}
export interface TacticalSample {
  id: string;
  gameId: string;
  history: string[];
  FEN: string;
  priorFens: string[];
  terminal: ReturnType<typeof nextRootTerminal>;
}
export type TacticalTask = { key: string; sample: number } & (
  | { kind: "reference"; depth: 3 | 4 }
  | {
      kind: "decision";
      opponent: "tal" | "fischer";
      level: "club" | "strong";
      seed: number;
      side: "candidate" | "baseline";
    }
);
export function createTacticalManifest(raw: string, settings: FreezeSettings) {
  if (
    !["development", "final"].includes(settings.purpose) ||
    ![settings.datasetSha, settings.context, settings.nonce].every(
      (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s),
    ) ||
    !Number.isSafeInteger(settings.expectedCount) ||
    settings.expectedCount < 1 ||
    sha256(raw) !== settings.datasetSha
  )
    throw new Error("Invalid frozen settings or dataset digest");
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length !== settings.expectedCount)
    throw new Error("Incomplete dataset");
  const ids = new Set<string>();
  const samples: TacticalSample[] = rows.map((value) => {
    const r = value as Omit<TacticalSample, "FEN"> & { fen: string };
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      typeof r.gameId !== "string" ||
      !r.gameId ||
      !Array.isArray(r.history) ||
      !r.history.every((s) => typeof s === "string") ||
      typeof r.fen !== "string"
    )
      throw new Error("Invalid or duplicate sample");
    ids.add(r.id);
    let p = START();
    const priorFens: string[] = [];
    for (const san of r.history) {
      const moves = legalMoves(p);
      if (nextRootTerminal(p, priorFens, moves))
        throw new Error("History continues after terminal position");
      const move = moves.find((m) => sanFor(p, m, applyMove(p, m)) === san);
      if (!move) throw new Error("Illegal history");
      priorFens.push(toFEN(p));
      p = applyMove(p, move);
    }
    if (toFEN(p) !== r.fen) throw new Error("Mismatched root FEN");
    return {
      id: r.id,
      gameId: r.gameId,
      history: [...r.history],
      FEN: r.fen,
      priorFens,
      terminal: nextRootTerminal(p, priorFens),
    };
  });
  if (samples.every((s) => s.terminal !== null)) throw new Error("No eligible positions");
  const tasks: TacticalTask[] = [];
  samples.forEach((s, sample) => {
    if (s.terminal === null)
      for (const depth of [3, 4] as const)
        tasks.push({ key: `reference-${sample}-${depth}`, sample, kind: "reference", depth });
  });
  samples.forEach((s, sample) => {
    if (s.terminal !== null) return;
    (settings.purpose === "final" ? [19471, 78157] : [317, 9029]).forEach((seed, seedIndex) => {
      for (const level of ["club", "strong"] as const)
        for (const opponent of ["tal", "fischer"] as const)
          for (const side of (sample + seedIndex) % 2 === 0
            ? (["candidate", "baseline"] as const)
            : (["baseline", "candidate"] as const))
            tasks.push({
              key: `decision-${sample}-${seed}-${level}-${opponent}-${side}`,
              sample,
              kind: "decision",
              seed,
              level,
              opponent,
              side,
            });
    });
  });
  const completeGames = (["tal", "fischer"] as const).flatMap((candidate) => [
    { candidate, baseline: candidate, level: "strong", pairs: 200 },
    { candidate, baseline: "spassky", level: "strong", pairs: 50 },
    { candidate, baseline: "chigorin", level: "strong", pairs: 50 },
    { candidate, baseline: candidate, level: "club", pairs: 100 },
  ]);
  return {
    version: 1 as const,
    settings: { ...settings },
    samples,
    tasks,
    completeGames,
    protocol: {
      referencePolicy: "next-neutral-v1",
      nodeCap: 10000000,
      referenceCapacityMs: 120000,
      decisionCapacityMs: 15000,
      forcingCapturePlies: 4,
      forcingSafetyPlies: 12,
      budgets: { club: 600, strong: 2000 },
      completeGameNamespace:
        "coherent-strength-v1:validation:<candidate>:<level>:<baseline>:<pair>",
      qualification: false as const,
    },
  };
}
export type TacticalManifest = ReturnType<typeof createTacticalManifest>;
