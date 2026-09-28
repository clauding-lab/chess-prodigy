export interface SearchPort<Input> {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: Input & { requestId: number }): void;
  terminate(): void;
}
interface Pending<Input, Result> {
  request: Input & { requestId: number };
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
  retries: number;
}
export class SearchTransport<Input extends { gameId: string; revision: number }, Result> {
  private worker: SearchPort<Input> | null = null;
  private pending: Pending<Input, Result> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private disposed = false;
  constructor(
    private factory: () => SearchPort<Input>,
    private validateInput: (input: Input) => boolean,
    private validateResult: (
      value: unknown,
      request: Input & { requestId: number },
    ) => value is Result,
    private budget: (input: Input) => number,
    private onFailure?: () => void,
  ) {}
  request(input: Input): Promise<Result> {
    if (this.disposed) return Promise.reject(new Error("Next engine client is disposed."));
    if (!this.validateInput(input))
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
        if (data.ok !== true || !this.validateResult(data.result, pending.request)) {
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
      this.timer = setTimeout(() => this.fail(), this.budget(pending.request) + 1000);
      worker.postMessage(pending.request);
    } catch {
      this.fail();
    }
  }
  private fail() {
    const pending = this.pending;
    if (!pending) return;
    this.stop();
    this.onFailure?.();
    if (this.pending !== pending) return;
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
