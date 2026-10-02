// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  buildReferenceWorker,
  createTacticalExecutor,
  tacticalContext,
} from "../../scripts/engine-bench/tactical-worker";
import { validateTacticalEvidence } from "../../scripts/engine-bench/tactical-evidence";
import { manifest } from "./tactical-fixtures";
it("executes unchanged E1 in a fresh worker on a synthetic START position", async () => {
  const m = manifest();
  const bundles = { experiment: "", tal: "", fischer: "", reference: buildReferenceWorker() };
  const executor = createTacticalExecutor(bundles);
  const output = await executor(m.tasks[0], m);
  expect(() => validateTacticalEvidence(m, m.tasks[0], output)).not.toThrow();
}, 20000);
it("binds source content, all bundles and machine metadata in the context digest", () => {
  const bundles = { experiment: "e", tal: "t", fischer: "f", reference: "r" };
  const a = tacticalContext({ "file.ts": "source" }, bundles, { cpu: "test" });
  expect(tacticalContext({ "file.ts": "source" }, bundles, { cpu: "test" })).toBe(a);
  expect(tacticalContext({ "file.ts": "changed" }, bundles, { cpu: "test" })).not.toBe(a);
  expect(
    tacticalContext({ "file.ts": "source" }, { ...bundles, reference: "changed" }, { cpu: "test" }),
  ).not.toBe(a);
  expect(tacticalContext({ "file.ts": "source" }, bundles, { cpu: "other" })).not.toBe(a);
});
it("preserves reference startup exits and calculation crashes with request and timings", async () => {
  const m = manifest();
  for (const [reference, stage] of [
    ["process.exit(4)", "startup"],
    [
      "const {parentPort}=require('node:worker_threads');parentPort.on('message',()=>{throw Error('synthetic crash')});parentPort.postMessage({ready:true})",
      "calculation",
    ],
  ]) {
    const executor = createTacticalExecutor({ experiment: "", tal: "", fischer: "", reference });
    try {
      await executor(m.tasks[0], m);
      throw new Error("Expected failure");
    } catch (error) {
      const failure = error as Error & {
        evidence: {
          stage: string;
          request: { depth: number };
          elapsedMs: number;
          capacityMs: number;
        };
      };
      expect(failure.evidence.stage).toBe(stage);
      expect(failure.evidence.request.depth).toBe(3);
      expect(failure.evidence.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(failure.evidence.capacityMs).toBe(120000);
    }
  }
});

it("retains reference capacity expiration without waiting two real minutes", async () => {
  vi.useFakeTimers();
  try {
    const m = manifest();
    const executor = createTacticalExecutor({
      experiment: "",
      tal: "",
      fischer: "",
      reference: "setInterval(()=>{},1000)",
    });
    const result = executor(m.tasks[0], m);
    const assertion = expect(result).rejects.toMatchObject({
      message: "Reference capacity deadline exceeded",
      evidence: { capacityMs: 120000, stage: "startup" },
    });
    await vi.advanceTimersByTimeAsync(120000);
    await assertion;
  } finally {
    vi.useRealTimers();
  }
});
