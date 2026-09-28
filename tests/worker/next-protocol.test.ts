import { afterEach, expect, it, vi } from "vitest";
import { fromFEN } from "../../src/engine/board";
import { searchNextShortlistReuse } from "../../src/engine/next/shortlist-reuse-search";
import { isNextResult, NEXT_WORKER_POLICY, type NextRequest } from "../../src/worker/next/protocol";
const request = (fen = "4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1"): NextRequest => ({
  requestId: 1,
  gameId: "dev",
  revision: 2,
  policy: NEXT_WORKER_POLICY,
  level: "casual",
  position: fromFEN(fen),
  history: [],
});
const search = (r: NextRequest) =>
  searchNextShortlistReuse(r.position, r.history, {
    maxDepth: 8,
    ms: 200,
    now: () => 0,
    maxNodes: 10000,
  });
afterEach(() => {
  vi.restoreAllMocks();
  self.onmessage = null;
});
it.each([
  "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
  "8/8/8/8/8/6k1/6q1/7K w - - 0 1",
  "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
  "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
])("accepts correctly identified terminal positions: %s", (fen) => {
  const r = request(fen),
    evidence = search(r);
  expect(evidence.kind).toBe("terminal");
  expect(isNextResult(evidence, r)).toBe(true);
  expect(isNextResult({ ...evidence, score: 900 }, r)).toBe(false);
});
it.each(["4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1", "4k3/8/8/4q3/3P4/2P5/8/4K3 b - - 0 1"])(
  "preserves bound kinds and rejects mislabelled/duplicate/missing alternatives: %s",
  (fen) => {
    const r = request(fen),
      evidence = search(r);
    expect(evidence.kind).toBe("completed");
    expect(isNextResult(evidence, r)).toBe(true);
    const bound = evidence.candidates.find((entry) => entry.kind !== "exact");
    expect(bound).toBeDefined();
    expect(isNextResult({ ...evidence, move: bound!.move, score: bound!.score }, r)).toBe(false);
    const opposite = structuredClone(evidence);
    opposite.candidates.find((entry) => entry.kind !== "exact")!.kind =
      r.position.turn === "w" ? "lower-bound" : "upper-bound";
    expect(isNextResult(opposite, r)).toBe(false);
    const duplicate = structuredClone(evidence);
    duplicate.candidates[1] = duplicate.candidates[0];
    expect(isNextResult(duplicate, r)).toBe(false);
    expect(isNextResult({ ...evidence, candidates: evidence.candidates.slice(1) }, r)).toBe(false);
    expect(isNextResult({ ...evidence, terminal: "stalemate" }, r)).toBe(false);
  },
);
it("worker executes frozen limits and rejects unsupported policy without a fallback", async () => {
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => {});
  await import("../../src/worker/next/engine.worker");
  const r = request("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  self.onmessage?.call(self, { data: r } as MessageEvent);
  expect(post.mock.calls[0][0]).toMatchObject({
    requestId: 1,
    gameId: "dev",
    revision: 2,
    ok: true,
    result: {
      kind: "terminal",
      policy: NEXT_WORKER_POLICY,
      settings: { maxDepth: 8, candidateWindowCp: 100, forcingSafetyPlies: 12 },
    },
  });
  self.onmessage?.call(self, { data: { ...r, policy: "old" } } as MessageEvent);
  expect(post.mock.calls[1][0]).toMatchObject({ ok: false });
});

it.each(["interruption", "attempt", "sequence", "nodes"])(
  "rejects contradictory completed iteration metadata: %s",
  (field) => {
    const r = request(),
      evidence = search(r);
    expect(evidence.kind).toBe("completed");
    expect(evidence.interruption).not.toBeNull();
    if (field === "interruption") evidence.interruption = null;
    if (field === "attempt") evidence.attemptedDepth = 8;
    if (field === "sequence") evidence.iterations.unshift({ ...evidence.iterations[0] });
    if (field === "nodes") evidence.iterations[0].nodes = evidence.nodes;
    expect(isNextResult(evidence, r)).toBe(false);
  },
);
it("rejects fabricated work/interruptions in a terminal result", () => {
  const r = request("4k3/8/8/8/8/8/8/4K3 w - - 0 1"),
    evidence = search(r);
  expect(isNextResult({ ...evidence, nodes: 1 }, r)).toBe(false);
  expect(isNextResult({ ...evidence, interruption: "deadline" }, r)).toBe(false);
});
it("rejects missing iteration slots preserved by structured clone", () => {
  const r = request(),
    evidence = search(r);
  expect(evidence.kind).toBe("completed");
  expect(evidence.interruption).not.toBeNull();
  Reflect.deleteProperty(evidence.iterations, evidence.iterations.length - 1);
  expect(isNextResult(structuredClone(evidence), r)).toBe(false);
});
