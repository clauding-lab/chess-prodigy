import { SearchTransport, type SearchPort } from "./transport";
import {
  isNextResult,
  NEXT_BUDGETS,
  NEXT_WORKER_POLICY,
  type NextInput,
  type NextResult,
} from "./protocol";
export type NextPort = SearchPort<NextInput>;
export class NextEngineClient extends SearchTransport<NextInput, NextResult> {
  constructor(
    factory: () => NextPort = () =>
      new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }),
  ) {
    super(
      factory,
      (input) =>
        input.policy === NEXT_WORKER_POLICY &&
        Object.hasOwn(NEXT_BUDGETS, input.level) &&
        Number.isSafeInteger(input.revision) &&
        input.revision >= 0 &&
        !!input.gameId &&
        Array.isArray(input.history) &&
        input.history.length <= 12800,
      isNextResult,
      (input) => NEXT_BUDGETS[input.level],
    );
  }
}
