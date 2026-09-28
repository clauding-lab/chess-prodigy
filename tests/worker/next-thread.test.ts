// @vitest-environment node
import { expect, it } from "vitest";
import { buildSync } from "esbuild";
import { Worker } from "node:worker_threads";
import { fromFEN } from "../../src/engine/board";
import { isNextResult, NEXT_WORKER_POLICY, type NextRequest } from "../../src/worker/next/protocol";

it("runs the actual worker entry in an isolated thread with cloned messages", async () => {
  const built = buildSync({
    entryPoints: ["src/worker/next/engine.worker.ts"],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "browser",
  }).outputFiles[0].text;
  // Node transport shim around the unmodified browser-worker entry; not browser/device evidence.
  const worker = new Worker(
    `const {parentPort}=require('node:worker_threads');
    globalThis.self={postMessage(value){parentPort.postMessage(value)}};
    ${built}
    parentPort.on('message',data=>self.onmessage({data}));`,
    { eval: true },
  );
  const request: NextRequest = {
    requestId: 19,
    gameId: "thread",
    revision: 2,
    policy: NEXT_WORKER_POLICY,
    level: "casual",
    position: fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1"),
    history: [],
  };
  try {
    const reply = await new Promise<{ requestId: number; ok: boolean; result: unknown }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Worker deadline exceeded")), 3000);
        worker.once("message", (value) => {
          clearTimeout(timer);
          resolve(value);
        });
        worker.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        worker.postMessage(request);
      },
    );
    expect(reply.requestId).toBe(19);
    expect(reply.ok).toBe(true);
    expect(isNextResult(reply.result, request)).toBe(true);
    expect(reply.result).toMatchObject({ kind: "completed", policy: NEXT_WORKER_POLICY });
  } finally {
    await worker.terminate();
  }
}, 5000);
