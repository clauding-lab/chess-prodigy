// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { START, legalMoves, toFEN } from "../../../src/engine/board";
import { digest } from "../../../scripts/engine-bench/core";

const state = vi.hoisted(() => ({ time: 0, output: "", cohortReads: 0, ids: [] as unknown[] }));
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: (_: string, data: string) => {
    state.output = data;
  },
}));
vi.mock("node:perf_hooks", () => ({ performance: { now: () => state.time } }));
vi.mock("../../../src/engine/next/search", () => ({
  searchNext: () => {
    state.time += 7;
    return {
      kind: "completed",
      get move() {
        state.time += 100;
        return legalMoves(START())[0];
      },
    };
  },
}));
vi.mock("../../../src/engine/next/ordered-search", () => ({
  searchNextOrdered: () => ({ kind: "incomplete", move: null, policy: "next-neutral-ordered-v1" }),
}));
vi.mock("../../../src/engine/next/cached-search", () => ({
  searchNextCached: () => ({
    kind: "incomplete",
    move: null,
    policy: "next-neutral-legal-cache-v1",
  }),
}));
vi.mock("../../../src/engine/next/shortlist-search", () => ({
  searchNextShortlist: () => ({
    kind: "incomplete",
    move: null,
    policy: "next-neutral-shortlist-v1",
  }),
}));
vi.mock("../../../src/engine/next/shortlist-reuse-search", () => ({
  searchNextShortlistReuse: () => ({
    kind: "incomplete",
    move: null,
    policy: "next-neutral-shortlist-reuse-v1",
  }),
}));
const originalArgv = process.argv;
afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

async function run(ids: unknown[], mismatch?: "development" | "manifest", variant?: string) {
  vi.resetModules();
  state.time = 0;
  state.output = "";
  state.cohortReads = 0;
  state.ids = ids;
  const raw = JSON.stringify(
    Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      split: "development",
      history: [],
      fen: toFEN(START()),
    })),
  );
  const manifestValue = { partitions: { development: digest(raw) } };
  const manifestRaw = JSON.stringify(manifestValue, null, 2) + "\n";
  const cohort = {
    samples: ids,
    developmentHash: mismatch === "development" ? "outdated" : digest(raw),
    datasetManifestHash:
      mismatch === "manifest" ? "outdated" : digest(JSON.stringify(manifestValue)),
  };
  vi.mocked(readFileSync).mockImplementation((path) => {
    const file = String(path);
    if (file.endsWith("development.json")) return raw;
    if (file.endsWith("/manifest.json")) return manifestRaw;
    if (file.endsWith("run-manifest.json")) {
      state.cohortReads++;
      return JSON.stringify({ ...cohort, read: state.cohortReads });
    }
    return "source";
  });
  process.argv = ["node", "profile-next.ts", "unused.json"];
  if (variant) process.argv.push(variant);
  vi.spyOn(console, "log").mockImplementation(() => {});
  await import("../../../scripts/engine-bench/profile-next");
  return JSON.stringify({ ...cohort, read: 1 });
}
const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
it("records search-only time and fingerprints the same cohort bytes it consumed", async () => {
  const consumed = await run(ids);
  const report = JSON.parse(state.output);
  expect(report.rows).toHaveLength(36);
  expect(report.rows.every((row: { wallMs: number }) => row.wallMs === 7)).toBe(true);
  expect(report.cohortHash).toBe(digest(consumed));
});
it.each([ids.slice(1), [...ids.slice(1), "p1"], [...ids.slice(1), 4]])(
  "rejects a malformed or repeated cohort before profiling: %j",
  async (...values) => {
    await expect(run(values)).rejects.toThrow("Invalid development cohort");
    expect(state.output).toBe("");
  },
);
it.each([
  ["ordered", "next-neutral-ordered-v1"],
  ["cached", "next-neutral-legal-cache-v1"],
  ["shortlist", "next-neutral-shortlist-v1"],
  ["shortlist-reuse", "next-neutral-shortlist-reuse-v1"],
])("uses %s explicitly and rejects unknown variants", async (variant, policy) => {
  await run(ids, undefined, variant);
  expect(
    JSON.parse(state.output).rows.every(
      (row: { result: { policy: string } }) => row.result.policy === policy,
    ),
  ).toBe(true);
  await expect(run(ids, undefined, "unknown")).rejects.toThrow("Unknown profile variant");
  expect(state.output).toBe("");
});
it.each(["development", "manifest"] as const)(
  "rejects internally consistent input that no longer matches the frozen cohort %s hash",
  async (mismatch) => {
    await expect(run(ids, mismatch)).rejects.toThrow("Frozen cohort dataset changed");
    expect(state.output).toBe("");
  },
);
