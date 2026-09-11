import type { EngineRequest, EngineReply, EngineResult, RequestInput } from "./protocol";
import { isNeutralEvaluation, REVIEW_POLICIES } from "../engine/reviewer";
export interface WorkerPort {
  onmessage: ((e: MessageEvent<EngineReply>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onmessageerror: ((e: MessageEvent) => void) | null;
  postMessage(r: EngineRequest): void;
  terminate(): void;
}
interface Pending {
  request: EngineRequest;
  resolve: (r: EngineResult) => void;
  reject: (e: Error) => void;
  retries: number;
}
const abortError = () => new DOMException("Calculation cancelled", "AbortError");
export class EngineClient {
  private worker: WorkerPort | null = null;
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private disposed = false;
  constructor(
    private factory: () => WorkerPort = () =>
      new Worker(new URL("../engine/engine.worker.ts", import.meta.url), { type: "module" }),
  ) {}
  request(input: RequestInput): Promise<EngineResult> {
    if (this.disposed) return Promise.reject(new Error("Engine client has been disposed"));
    this.cancel();
    return new Promise((resolve, reject) => {
      this.pending = {
        request: { ...input, requestId: ++this.nextId },
        resolve,
        reject,
        retries: 0,
      };
      this.send();
    });
  }
  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private stopWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.clearTimer();
  }
  private send() {
    const pending = this.pending;
    if (!pending) return;
    try {
      const worker = this.worker ?? this.factory();
      this.worker = worker;
      worker.onmessage = (event) => {
        if (this.worker !== worker || this.pending !== pending) return;
        const reply = event.data;
        if (
          !reply ||
          reply.requestId !== pending.request.requestId ||
          reply.gameId !== pending.request.gameId ||
          reply.revision !== pending.request.revision ||
          reply.type !== pending.request.type
        )
          return;
        if (!reply.ok) {
          this.fail();
          return;
        }
        const result = reply.result;
        if (
          !result ||
          !(result.score === null || Number.isFinite(result.score)) ||
          !("move" in result)
        ) {
          this.fail();
          return;
        }
        if (
          pending.request.type === "analyse" &&
          (!("review" in result) ||
            result.score === null ||
            !isNeutralEvaluation(
              { score: result.score, best: result.move, review: result.review },
              pending.request.position,
              pending.request.history,
              pending.request.policy,
            ))
        ) {
          this.fail();
          return;
        }
        this.clearTimer();
        this.pending = null;
        pending.resolve(result);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (this.worker === worker) this.fail();
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) this.fail();
      };
      const request = pending.request;
      const budget =
        request.type === "ai"
          ? { casual: 200, club: 600, strong: 2000 }[request.level]
          : request.type === "analyse"
            ? REVIEW_POLICIES[request.policy].ms
            : request.ms;
      this.timer = setTimeout(() => this.fail(), budget + 1000);
      worker.postMessage(request);
    } catch {
      this.fail();
    }
  }
  private fail() {
    const pending = this.pending;
    if (!pending) return;
    this.stopWorker();
    if (pending.retries === 0) {
      pending.retries++;
      this.send();
    } else {
      this.pending = null;
      pending.reject(new Error("Engine calculation failed after retry. Please try again."));
    }
  }
  cancel() {
    const pending = this.pending;
    this.pending = null;
    this.stopWorker();
    pending?.reject(abortError());
  }
  dispose() {
    this.disposed = true;
    this.cancel();
  }
}
