import type { ExperimentRequest } from "../../src/worker/next/experiment-protocol";

export interface StrengthFailureEvidence {
  version: 1;
  stage: "startup" | "calculation" | "reply-validation" | "decision";
  request: Pick<
    ExperimentRequest,
    "requestId" | "gameId" | "revision" | "position" | "level" | "opponent"
  > &
    Partial<Pick<ExperimentRequest, "history" | "turnDeadline">>;
  startupMs: number | null;
  calculationMs: number | null;
  elapsedMs: number;
  capacityMs: number;
  exitCode: number | null;
  reply: unknown;
  /** Authoritative lossless Node encoding; reply is only the readable JSON projection. */
  replyV8Base64?: string;
}

export class StrengthWorkerFailure extends Error {
  constructor(
    message: string,
    readonly evidence: StrengthFailureEvidence,
  ) {
    super(message);
    this.name = "StrengthWorkerFailure";
  }
}
