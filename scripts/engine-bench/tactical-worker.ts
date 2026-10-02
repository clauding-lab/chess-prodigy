import { Worker } from "node:worker_threads";
import { buildSync } from "esbuild";
import { fromFEN } from "../../src/engine/board";
import { workerChooser, type buildStrengthWorkers } from "./strength-worker";
import { sha256, type TacticalManifest, type TacticalTask } from "./tactical-manifest";
import type { TacticalOutput } from "./tactical-evidence";
export type TacticalBundles = ReturnType<typeof buildStrengthWorkers> & { reference: string };
export function buildReferenceWorker() {
  return buildSync({
    stdin: {
      contents: `import {parentPort} from 'node:worker_threads';
    import {searchNext} from './src/engine/next/search';
    parentPort.on('message', ({position,history,depth}) => {
      const detail=searchNext(position,history,{maxDepth:depth,ms:120000,now:()=>0,maxNodes:10000000,forcingSafetyPlies:12,baselineOnly:false});
      parentPort.postMessage({detail});
    }); parentPort.postMessage({ready:true});`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  }).outputFiles[0].text;
}
/** Caller must include the complete reviewed source inventory (including this harness and lockfile).
 * This helper hashes supplied contents, not paths; reread that inventory at every runner boundary. */
export function tacticalContext(
  sourceContents: Record<string, string>,
  bundles: TacticalBundles,
  machine: Record<string, string | number>,
) {
  const sorted = (record: Record<string, string | number>) =>
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  if (!Object.keys(sourceContents).length || !Object.keys(machine).length)
    throw new Error("Missing context inventory");
  return sha256(
    JSON.stringify({
      source: sorted(
        Object.fromEntries(Object.entries(sourceContents).map(([p, s]) => [p, sha256(s)])),
      ),
      bundles: sorted(Object.fromEntries(Object.entries(bundles).map(([p, s]) => [p, sha256(s)]))),
      machine: sorted(machine),
      policy: "durable-tactical-v1",
    }),
  );
}
export function createTacticalExecutor(inputBundles: TacticalBundles) {
  const bundles = { ...inputBundles };
  return async (task: TacticalTask, manifest: TacticalManifest): Promise<TacticalOutput> => {
    const sample = manifest.samples[task.sample],
      position = fromFEN(sample.FEN);
    if (task.kind === "decision") {
      const row = {
        key: task.key,
        candidate: task.opponent,
        baseline: task.opponent,
        level: task.level,
        pair: 0,
        color: position.turn,
        seed: task.seed,
        baselineSeed: task.seed,
      };
      return workerChooser(row, bundles)(
        position,
        sample.priorFens,
        sample.history,
        task.side === "candidate",
      );
    }
    const started = performance.now(),
      worker = new Worker(bundles.reference, { eval: true });
    let startupMs = 0,
      calculationStart = started,
      sent = false;
    let exitCode: number | null = null;
    const request = { position, history: sample.priorFens, depth: task.depth };
    try {
      return await new Promise<TacticalOutput>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Reference capacity deadline exceeded")),
          120000,
        );
        const fail = (error: Error) => {
          clearTimeout(timer);
          reject(error);
        };
        worker.once("error", fail);
        worker.once("exit", (code) => {
          exitCode = code;
          fail(new Error(`Reference exited before reply: ${code}`));
        });
        worker.on("message", (message) => {
          if (message?.ready === true && !sent) {
            sent = true;
            calculationStart = performance.now();
            startupMs = calculationStart - started;
            worker.postMessage(request);
          } else if (sent && message && Object.hasOwn(message, "detail")) {
            clearTimeout(timer);
            resolve({
              startupMs,
              calculationMs: performance.now() - calculationStart,
              detail: message.detail,
            });
          }
        });
      });
    } catch (error) {
      throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
        evidence: {
          version: 1,
          kind: "reference-worker-failure",
          stage: sent ? "calculation" : "startup",
          request,
          startupMs: sent ? startupMs : null,
          calculationMs: sent ? performance.now() - calculationStart : null,
          elapsedMs: performance.now() - started,
          capacityMs: 120000,
          exitCode,
        },
      });
    } finally {
      await worker.terminate();
    }
  };
}
