import {
  isNextResult,
  NEXT_BUDGETS,
  NEXT_WORKER_POLICY,
  type NextInput,
  type NextRequest,
  type NextResult,
} from "./protocol";
export interface NextPort {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: NextRequest): void;
  terminate(): void;
}
interface Pending {
  request: NextRequest;
  resolve: (result: NextResult) => void;
  reject: (error: Error) => void;
  retries: number;
}
export class NextEngineClient {
  private worker: NextPort | null = null;
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private disposed = false;
  constructor(
    private factory: () => NextPort = () =>
      new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }),
  ) {}
  request(input: NextInput): Promise<NextResult> {
    if (this.disposed) return Promise.reject(new Error("Next engine client is disposed."));
    if (
      input.policy !== NEXT_WORKER_POLICY ||
      !Object.hasOwn(NEXT_BUDGETS, input.level) ||
      !Number.isSafeInteger(input.revision) ||
      input.revision < 0 ||
      !input.gameId ||
      !Array.isArray(input.history) ||
      input.history.length > 12800
    )
      return Promise.reject(new Error("Invalid next engine request."));
    this.cancel();
    return new Promise((resolve, reject) => {
      this.pending = {
        request: { ...structuredClone(input), requestId: ++this.nextId },
        resolve,
        reject,
        retries: 0,
      };
      this.send();
    });
  }
  private stop() {
    this.worker?.terminate();
    this.worker = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private send() {
    const pending = this.pending;
    if (!pending) return;
    try {
      const worker = this.factory();
      this.worker = worker;
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker || this.pending !== pending) return;
        if (
          !data ||
          data.requestId !== pending.request.requestId ||
          data.gameId !== pending.request.gameId ||
          data.revision !== pending.request.revision
        )
          return;
        if (data.ok !== true || !isNextResult(data.result, pending.request)) {
          this.fail();
          return;
        }
        this.pending = null;
        this.stop();
        pending.resolve(data.result);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (this.worker === worker) this.fail();
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) this.fail();
      };
      this.timer = setTimeout(() => this.fail(), NEXT_BUDGETS[pending.request.level] + 1000);
      worker.postMessage(pending.request);
    } catch {
      this.fail();
    }
  }
  private fail() {
    const pending = this.pending;
    if (!pending) return;
    this.stop();
    if (pending.retries++ === 0) this.send();
    else {
      this.pending = null;
      pending.reject(new Error("Experimental calculation failed after retry. Please try again."));
    }
  }
  cancel() {
    const pending = this.pending;
    this.pending = null;
    this.stop();
    pending?.reject(new DOMException("Calculation cancelled", "AbortError"));
  }
  dispose() {
    this.disposed = true;
    this.cancel();
  }
}
