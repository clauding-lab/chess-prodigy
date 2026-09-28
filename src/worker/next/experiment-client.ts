import { SearchTransport, type SearchPort } from "./transport";
import { isExperimentalOpponent } from "../../engine/opponents";
import { EXPERIMENT_BUDGETS, type ExperimentDecision } from "../../engine/next/roster";
import { isExperimentResult, type ExperimentInput } from "./experiment-protocol";
export class ExperimentClient extends SearchTransport<ExperimentInput, ExperimentDecision> {
  constructor(
    onFailure?: () => void,
    factory: () => SearchPort<ExperimentInput> = () =>
      new Worker(new URL("./experiment.worker.ts", import.meta.url), { type: "module" }),
  ) {
    super(
      factory,
      (input) =>
        isExperimentalOpponent(input.opponent) &&
        Object.hasOwn(EXPERIMENT_BUDGETS, input.level) &&
        !!input.gameId &&
        Number.isSafeInteger(input.revision) &&
        input.revision >= 0 &&
        Array.isArray(input.history) &&
        input.history.length <= 12800 &&
        (input.turnDeadline === null || Number.isFinite(input.turnDeadline)),
      isExperimentResult,
      (input) =>
        Math.min(
          EXPERIMENT_BUDGETS[input.level],
          input.turnDeadline === null ? Infinity : Math.max(0, input.turnDeadline - Date.now()),
        ),
      onFailure,
    );
  }
}
