import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { arch, cpus, platform } from "node:os";
import { buildSync } from "esbuild";
import { buildStrengthWorkers } from "./strength-worker";
import { buildReferenceWorker, tacticalContext } from "./tactical-worker";
import { sha256 } from "./tactical-manifest";
export const FINAL_DATASET = {
  datasetSha: "9bb05f85a06c9f9d1add79ad562dacc88735e82645bd9c3daff61f7ad3081270",
  expectedCount: 160,
} as const;
export const FINAL_RELATIVE =
  ".superpowers/sdd/2026-09-27-repair-and-engine-master-plan/final-validation-v1";
export const REGISTRY_RELATIVE =
  ".superpowers/sdd/2026-09-27-repair-and-engine-master-plan/final-programme-registry";
const files = (root: string, path: string): string[] =>
  readdirSync(join(root, path), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(root, join(path, e.name)) : [join(path, e.name)],
  );
export function finalSourceContents(root: string) {
  const inventory = [
    ...files(root, "src"),
    ...files(root, "scripts/engine-bench"),
    ...files(root, "tests/calibration"),
    "scripts/calibration/core.ts",
    "package.json",
    "package-lock.json",
    "docs/superpowers/specs/2026-09-29-strength-protocol.md",
    "docs/superpowers/specs/2026-09-29-tactical-validation.md",
    "docs/superpowers/specs/2026-10-02-durable-tactical-runner.md",
    "docs/superpowers/plans/2026-10-02-final-programme.md",
  ].sort();
  return Object.fromEntries(inventory.map((p) => [p, readFileSync(join(root, p), "utf8")]));
}
export const finalMachine = () => ({
  node: process.version,
  arch: arch(),
  platform: platform(),
  cpu: cpus()[0].model,
  cpuCount: cpus().length,
});
export function buildFinalBundles() {
  const browser = (path: string) =>
    buildSync({
      entryPoints: [path],
      bundle: true,
      write: false,
      platform: "browser",
      format: "cjs",
    }).outputFiles[0].text;
  return {
    ...buildStrengthWorkers(),
    spassky: browser("src/engine/spassky.worker.ts"),
    chigorin: browser("src/engine/engine.worker.ts"),
    reference: buildReferenceWorker(),
  };
}
export type FinalBundles = ReturnType<typeof buildFinalBundles>;
export function finalContext(root: string, bundles: FinalBundles) {
  const sources = finalSourceContents(root);
  return {
    sources: Object.fromEntries(Object.entries(sources).map(([p, s]) => [p, sha256(s)])),
    machine: finalMachine(),
    digest: tacticalContext(sources, bundles, finalMachine()),
    bundles: Object.fromEntries(Object.entries(bundles).map(([p, s]) => [p, sha256(s)])),
  };
}
