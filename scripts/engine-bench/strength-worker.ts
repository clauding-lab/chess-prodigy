import { Worker } from "node:worker_threads";
import { buildSync } from "esbuild";
import { experimentalRosterConfig, rosterConfig } from "../../src/engine/opponents";
import {
  isExperimentResult,
  type ExperimentRequest,
} from "../../src/worker/next/experiment-protocol";
import type { AiResult } from "../../src/engine/types";
import type { StrengthRow } from "./strength-core";
import type { StrengthChooser } from "./strength-match";

export function buildStrengthWorkers() {
  return Object.fromEntries(
    [
      ["experiment", "src/worker/next/experiment.worker.ts"],
      ["tal", "src/engine/tal.worker.ts"],
      ["fischer", "src/engine/fischer.worker.ts"],
    ].map(([id, path]) => [
      id,
      buildSync({
        entryPoints: [path],
        bundle: true,
        write: false,
        platform: "browser",
        format: "cjs",
      }).outputFiles[0].text,
    ]),
  ) as Record<"experiment" | "tal" | "fischer", string>;
}
export function workerChooser(
  row: StrengthRow,
  bundles: ReturnType<typeof buildStrengthWorkers>,
): StrengthChooser {
  return async (position, history, moves, candidate) => {
    const started = performance.now();
    const worker = new Worker(
      `const {parentPort}=require('node:worker_threads');
      globalThis.self={postMessage(value){parentPort.postMessage({reply:value})}};
      ${bundles[candidate ? "experiment" : row.baseline]}
      parentPort.on('message',data=>self.onmessage({data}));
      parentPort.postMessage({ready:true});`,
      { eval: true },
    );
    const common = {
      requestId: moves.length + 1,
      gameId: row.key,
      revision: moves.length,
      position,
      level: row.level,
    };
    const request = candidate
      ? {
          ...common,
          opponent: experimentalRosterConfig(row.candidate, row.seed),
          history: [...history],
          turnDeadline: null,
        }
      : {
          ...common,
          type: "ai",
          opponent: rosterConfig(row.baseline, row.baselineSeed),
          bookSans: [],
          ply: moves.length,
        };
    let calculationStart = started,
      startupMs = 0;
    try {
      const reply = await new Promise<{
        ok: boolean;
        requestId: number;
        gameId: string;
        revision: number;
        result: unknown;
      }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Worker capacity deadline exceeded")),
          15000,
        );
        const cleanup = () => clearTimeout(timer);
        worker.once("error", (error) => {
          cleanup();
          reject(error);
        });
        worker.once("exit", () => {
          cleanup();
          reject(new Error("Worker exited before reply"));
        });
        let sent = false;
        worker.on("message", (message) => {
          if (message.ready === true && !sent) {
            sent = true;
            calculationStart = performance.now();
            startupMs = calculationStart - started;
            worker.postMessage(request);
          } else if (message.reply && sent) {
            cleanup();
            resolve(message.reply);
          }
        });
      });
      const calculationMs = performance.now() - calculationStart;
      if (
        !reply.ok ||
        reply.requestId !== request.requestId ||
        reply.gameId !== request.gameId ||
        reply.revision !== request.revision
      )
        throw new Error("Invalid worker reply identity");
      if (candidate) {
        if (!isExperimentResult(reply.result, request as ExperimentRequest))
          throw new Error("Invalid experimental decision evidence");
        if (reply.result.kind !== "move" && reply.result.kind !== "book")
          throw new Error(`Experimental ${reply.result.kind} calculation`);
      }
      const result = reply.result as AiResult;
      if (!result || !result.move) throw new Error("Worker returned no move");
      return { move: result.move, startupMs, calculationMs, detail: reply.result };
    } finally {
      await worker.terminate();
    }
  };
}
