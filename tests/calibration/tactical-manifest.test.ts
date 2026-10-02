import { expect, it } from "vitest";
import { applyMove, legalMoves, sanFor, START, toFEN } from "../../src/engine/board";
import { createTacticalManifest, sha256 } from "../../scripts/engine-bench/tactical-manifest";
function sample(history: string[] = [], id = "sample") {
  let p = START();
  for (const san of history) {
    const m = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === san)!;
    p = applyMove(p, m);
  }
  return { id, gameId: "source", history, fen: toFEN(p) };
}
const options = { purpose: "development" as const, context: "a".repeat(64), nonce: "b".repeat(64) };
function freeze(rows: unknown[]) {
  const raw = JSON.stringify(rows);
  return createTacticalManifest(raw, {
    ...options,
    datasetSha: sha256(raw),
    expectedCount: rows.length,
  });
}
it("freezes every position/seed/opponent/level/side and independent references", () => {
  const m = freeze([sample(), sample(["e4"], "black")]);
  expect(m.tasks).toHaveLength(36);
  expect(m.tasks.slice(0, 4).map((t) => t.kind)).toEqual(Array(4).fill("reference"));
  const d = m.tasks.filter((t) => t.kind === "decision");
  expect(d).toHaveLength(32);
  expect(d.slice(0, 2).map((t) => t.side)).toEqual(["candidate", "baseline"]);
  expect(d.slice(8, 10).map((t) => t.side)).toEqual(["baseline", "candidate"]);
  expect(d.slice(16, 18).map((t) => t.side)).toEqual(["baseline", "candidate"]);
  expect(new Set(m.tasks.map((t) => t.key)).size).toBe(36);
  expect(m.samples[1].priorFens).toEqual([toFEN(START())]);
  expect(m.completeGames.reduce((n, r) => n + r.pairs * 2, 0)).toBe(1600);
});
it("rejects altered/partial datasets, duplicated IDs and malformed records", () => {
  const raw = JSON.stringify([sample()]);
  for (const patch of [{ datasetSha: "0".repeat(64) }, { expectedCount: 2 }])
    expect(() =>
      createTacticalManifest(raw, {
        ...options,
        datasetSha: sha256(raw),
        expectedCount: 1,
        ...patch,
      }),
    ).toThrow();
  for (const rows of [
    [sample(), sample()],
    [{ ...sample(), history: ["e5"] }],
    [{ ...sample(), fen: "wrong" }],
    [{ ...sample(), gameId: "" }],
    [],
  ])
    expect(() => freeze(rows)).toThrow();
});
it("retains terminal exclusions and rejects moves after a terminal position", () => {
  const mate = sample(["f3", "e5", "g4", "Qh4#"], "mate");
  const m = freeze([sample(), mate]);
  expect(m.samples[1].terminal).toBe("checkmate");
  expect(m.tasks).toHaveLength(18);
  expect(() => freeze([mate])).toThrow();
  expect(() => freeze([{ ...mate, history: [...mate.history, "a3"] }])).toThrow(/terminal/);
  const repetition = sample(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
  expect(freeze([sample([], "start"), repetition]).samples[1].terminal).toBe(
    "threefold-repetition",
  );
});
it("pins final seeds without reading any real dataset", () => {
  const raw = JSON.stringify([sample()]);
  const m = createTacticalManifest(raw, {
    ...options,
    purpose: "final",
    expectedCount: 1,
    datasetSha: sha256(raw),
  });
  expect([...new Set(m.tasks.filter((t) => t.kind === "decision").map((t) => t.seed))]).toEqual([
    19471, 78157,
  ]);
});
