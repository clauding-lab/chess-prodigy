import { expect, it } from "vitest";
import {
  assembleTacticalReport,
  validateTacticalEvidence,
} from "../../scripts/engine-bench/tactical-evidence";
import { evidence, manifest } from "./tactical-fixtures";
it("validates every scheduled output and reports complete separate groups without qualification", () => {
  const m = manifest(),
    records = m.tasks.map((task) => ({ key: task.key, output: evidence(m, task) }));
  for (const [i, record] of records.entries())
    expect(() => validateTacticalEvidence(m, m.tasks[i], record.output)).not.toThrow();
  const r = assembleTacticalReport(m, records);
  expect(r.qualification).toBe(false);
  expect(r.groups).toHaveLength(4);
  expect(r.groups.map((g) => g.interval.decisions)).toEqual([2, 2, 2, 2]);
  expect(r.review).toHaveLength(8);
  for (const pair of r.review) {
    expect(Object.keys(pair).sort()).toEqual(
      ["A", "B", "FEN", "history", "id", "references"].sort(),
    );
    for (const side of [pair.A, pair.B])
      expect(Object.keys(side).sort()).toEqual(["move", "depth3", "depth4", "failure"].sort());
  }
  expect(r.privateMapping).toHaveLength(8);
  for (const altered of [
    records.slice(1),
    [...records, records[0]],
    [...records.slice(1), { ...records[0], key: "extra" }],
  ])
    expect(() => assembleTacticalReport(m, altered)).toThrow();
});
it("rejects wrong reference identity, depth, bounds, score, coverage and timings", () => {
  const m = manifest(),
    t = m.tasks[0],
    good = evidence(m, t);
  const detail = good.detail;
  for (const patch of [
    { policy: "other" },
    { depth: 2 },
    { interruption: "nodes" },
    { score: 1 },
    { nodes: 10000001 },
    { candidates: [] },
    { history: "wrong" },
    { settings: {} },
  ])
    expect(() =>
      validateTacticalEvidence(m, t, { ...good, detail: { ...detail, ...patch } }),
    ).toThrow();
  for (const patch of [{ startupMs: NaN }, { calculationMs: -1 }, { calculationMs: 120000 }])
    expect(() => validateTacticalEvidence(m, t, { ...good, ...patch })).toThrow();
});
it("rejects wrong candidate provenance, baseline metadata and over-cap decisions", () => {
  const m = manifest();
  for (const t of m.tasks.filter((t) => t.kind === "decision")) {
    const good = evidence(m, t);
    expect(() => validateTacticalEvidence(m, t, { ...good, calculationMs: 15000 })).toThrow();
    expect(() =>
      validateTacticalEvidence(m, t, {
        ...good,
        detail: { ...good.detail, move: { ...good.move, capture: "bQ" } },
      }),
    ).toThrow();
    if (t.kind === "decision" && t.side === "candidate")
      expect(() =>
        validateTacticalEvidence(m, t, {
          ...good,
          detail: { ...good.detail, opponent: { id: "tal", version: 1 } },
        }),
      ).toThrow();
  }
});
it("converts black scores, preserves both-depth categories, and counts correlated seeds within a game", async () => {
  const { applyMove, legalMoves, sanFor, START, toFEN } = await import("../../src/engine/board");
  const { createTacticalManifest, sha256 } =
    await import("../../scripts/engine-bench/tactical-manifest");
  const { settings } = await import("./tactical-fixtures");
  const p = START(),
    move = legalMoves(p).find((m) => sanFor(p, m, applyMove(p, m)) === "e4")!;
  const raw = JSON.stringify([
    { id: "black", gameId: "one-game", history: ["e4"], fen: toFEN(applyMove(p, move)) },
  ]);
  const m = createTacticalManifest(raw, { ...settings, datasetSha: sha256(raw) });
  const records = m.tasks.map((t) => {
    const output = evidence(m, t);
    if (t.kind === "reference") {
      const d = output.detail;
      if ("candidates" in d) {
        d.candidates[0].score = 300;
        d.move = d.candidates[1].move;
      }
    }
    return { key: t.key, output };
  });
  const report = assembleTacticalReport(m, records);
  expect(
    report.groups.every(
      (g) =>
        g.interval.games === 1 && g.interval.candidateRate === 1 && g.interval.baselineRate === 1,
    ),
  ).toBe(true);
  expect(report.review[0].A.depth3).toEqual({ best: -0, selected: -300, flags: ["material-loss"] });
  expect(report.review[0].A.failure).toBe(true);
});
it("rejects duplicate reference root coverage even with the correct number of entries", () => {
  const m = manifest(),
    t = m.tasks[0],
    output = evidence(m, t);
  if ("candidates" in output.detail) output.detail.candidates[1] = output.detail.candidates[0];
  expect(() => validateTacticalEvidence(m, t, output)).toThrow();
});
it("projects anonymous moves and reference entries without untrusted extra metadata", () => {
  const m = manifest(),
    records = m.tasks.map((t) => {
      const output = evidence(m, t);
      if (output.move) Object.assign(output.move, { opponent: "private opponent" });
      if ("candidates" in output.detail) {
        for (const entry of output.detail.candidates) {
          Object.assign(entry, { policy: "private policy" });
          Object.assign(entry.move, { opponent: "private opponent" });
        }
      }
      return { key: t.key, output };
    });
  const report = assembleTacticalReport(m, records);
  for (const pair of report.review) {
    for (const side of [pair.A, pair.B]) expect(side.move).not.toHaveProperty("opponent");
    for (const ref of pair.references)
      for (const entry of ref.candidates) {
        expect(entry).not.toHaveProperty("policy");
        expect(entry.move).not.toHaveProperty("opponent");
      }
  }
});
