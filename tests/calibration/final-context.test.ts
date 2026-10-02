// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import {
  finalSourceContents,
  buildFinalBundles,
  FINAL_DATASET,
} from "../../scripts/engine-bench/final-context";
import { workerChooser } from "../../scripts/engine-bench/strength-worker";
import { finalStrengthSchedule } from "../../scripts/engine-bench/final-strength";
import { START, legalMoves, sameMove } from "../../src/engine/board";
it("captures source/books/harness/reporting/tests/lockfile and detects changed or added files", () => {
  const root = mkdtempSync(join(tmpdir(), "final-inventory-test-"));
  const names = [
    "src/book/book.ts",
    "scripts/engine-bench/assembler.ts",
    "tests/calibration/a.test.ts",
    "scripts/calibration/core.ts",
    "package.json",
    "package-lock.json",
    "docs/superpowers/specs/2026-09-29-strength-protocol.md",
    "docs/superpowers/specs/2026-09-29-tactical-validation.md",
    "docs/superpowers/specs/2026-10-02-durable-tactical-runner.md",
    "docs/superpowers/plans/2026-10-02-final-programme.md",
  ];
  for (const p of names) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), p);
  }
  expect(Object.keys(finalSourceContents(root))).toEqual([...names].sort());
  writeFileSync(join(root, "src/book/new.ts"), "new");
  expect(finalSourceContents(root)).toHaveProperty("src/book/new.ts", "new");
  expect(FINAL_DATASET.expectedCount).toBe(160);
});
it("routes registered cross-opponent baselines through actual production workers", async () => {
  const bundles = buildFinalBundles();
  for (const baseline of ["spassky", "chigorin"]) {
    const row = finalStrengthSchedule().find((r) => r.baseline === baseline)!;
    const d = await workerChooser(row, bundles)(START(), [], [], false);
    expect(legalMoves(START()).some((m) => sameMove(m, d.move))).toBe(true);
  }
}, 20000);
