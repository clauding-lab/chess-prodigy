// @vitest-environment node
import { expect, it } from "vitest";
import { START, applyMove, legalMoves, sameMove, toFEN } from "../../src/engine/board";
import { strengthSchedule } from "../../scripts/engine-bench/strength-core";
import { buildStrengthWorkers, workerChooser } from "../../scripts/engine-bench/strength-worker";

it("executes both real worker entries in fresh threads and preserves experimental provenance", async () => {
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const choose = workerChooser(row, buildStrengthWorkers());
  const start = START();
  const candidate = await choose(start, [], [], true);
  expect(legalMoves(start).some((move) => sameMove(move, candidate.move))).toBe(true);
  expect(candidate.detail).toMatchObject({
    kind: "book",
    policy: "coherent-roster-v1",
    opponent: { id: "tal", version: 2 },
  });
  expect(candidate.startupMs).toBeGreaterThan(0);
  expect(candidate.calculationMs).toBeGreaterThan(0);
  const after = applyMove(start, candidate.move);
  const baseline = await choose(after, [toFEN(start)], ["fixture-ply"], false);
  expect(legalMoves(after).some((move) => sameMove(move, baseline.move))).toBe(true);
  expect(baseline.startupMs).toBeGreaterThan(0);
  expect(baseline.calculationMs).toBeGreaterThan(0);
}, 10000);

it("retains failed worker evidence in a JSON game record without playing a replacement move", async () => {
  const { buildSync } = await import("esbuild");
  const { playStrengthGame, verifyStrengthGame } =
    await import("../../scripts/engine-bench/strength-match");
  const experiment = buildSync({
    stdin: {
      contents: `import {decideExperiment} from './src/engine/next/roster';
      self.onmessage=({data:r})=>self.postMessage({ok:true,requestId:r.requestId,gameId:r.gameId,revision:r.revision,
        result:decideExperiment(r.position,r.history,r.opponent,r.level,{}, {remainingMs:0})});`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: "browser",
    format: "cjs",
  }).outputFiles[0].text;
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = JSON.parse(
    JSON.stringify(
      await playStrengthGame(row, workerChooser(row, { experiment, tal: "", fischer: "" })),
    ),
  );
  expect(game).toMatchObject({
    score: null,
    reason: "decision-failure",
    moves: [],
    decisions: [],
    failureEvidence: {
      version: 1,
      stage: "decision",
      request: { gameId: row.key, revision: 0, requestId: 1 },
      reply: {
        ok: true,
        result: {
          kind: "incomplete",
          move: null,
          search: { interruption: "deadline", iterations: [] },
        },
      },
    },
  });
  expect(game.failureEvidence.startupMs).toBeGreaterThan(0);
  expect(game.failureEvidence.calculationMs).toBeGreaterThan(0);
  expect(() => verifyStrengthGame(game, row)).not.toThrow();
});

it.each([
  ["throw new Error('fixture crash')", "startup", "fixture crash"],
  ["process.exit(7)", "startup", "Worker exited before reply"],
  [
    "self.onmessage=()=>self.postMessage({ok:true,requestId:-1})",
    "reply-validation",
    "Invalid worker reply identity",
  ],
])("preserves failure stage and stops for %s", async (experiment, stage, message) => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, { experiment, tal: "", fischer: "" }),
  );
  expect(game).toMatchObject({
    score: null,
    moves: [],
    failure: message,
    failureEvidence: { version: 1, stage },
  });
});

it("retains the 15-second capacity failure without inventing a reply", async () => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, { experiment: "self.onmessage=()=>{}", tal: "", fischer: "" }),
  );
  expect(game).toMatchObject({
    score: null,
    moves: [],
    failure: "Worker capacity deadline exceeded",
    failureEvidence: { stage: "calculation", capacityMs: 15000, reply: null, exitCode: null },
  });
  expect(game.failureEvidence!.elapsedMs).toBeGreaterThanOrEqual(15000);
}, 20000);

it("preserves a non-JSON reply without preventing the unresolved record from being saved", async () => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const { deserialize } = await import("node:v8");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, {
      experiment: `self.onmessage=()=>{const value={ok:false,extra:1n};value.circular=value;self.postMessage(value)}`,
      tal: "",
      fischer: "",
    }),
  );
  const saved = JSON.parse(JSON.stringify(game));
  expect(saved.failureEvidence).toMatchObject({ stage: "reply-validation", reply: null });
  const reply = deserialize(Buffer.from(saved.failureEvidence.replyV8Base64, "base64"));
  expect(reply.extra).toBe(1n);
  expect(reply.circular).toBe(reply);
});

it("keeps lossless evidence when JSON would silently erase malformed values", async () => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const { deserialize } = await import("node:v8");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, {
      experiment: `self.onmessage=()=>self.postMessage({ok:false,number:NaN,missing:undefined,extra:new Map([['cause','fixture']])})`,
      tal: "",
      fischer: "",
    }),
  );
  const saved = JSON.parse(JSON.stringify(game));
  expect(saved.failureEvidence.replyV8Base64).toEqual(expect.any(String));
  const reply = deserialize(Buffer.from(saved.failureEvidence.replyV8Base64, "base64"));
  expect(Number.isNaN(reply.number)).toBe(true);
  expect(Object.hasOwn(reply, "missing")).toBe(true);
  expect(reply.extra.get("cause")).toBe("fixture");
});

it("retains an illegal baseline reply rejected before board mutation", async () => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const row = strengthSchedule("development", "tal", "casual", "tal")[1];
  const tal = `self.onmessage=({data:r})=>self.postMessage({ok:true,requestId:r.requestId,gameId:r.gameId,revision:r.revision,result:{move:{from:0,to:63},score:0,book:false}})`;
  const game = await playStrengthGame(
    row,
    workerChooser(row, { experiment: "", tal, fischer: "" }),
  );
  expect(game).toMatchObject({
    score: null,
    moves: [],
    failureEvidence: { stage: "decision", reply: { result: { move: { from: 0, to: 63 } } } },
  });
});

it("rejects failure records with a substituted opponent or prior history", async () => {
  const { playStrengthGame, verifyStrengthGame } =
    await import("../../scripts/engine-bench/strength-match");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, { experiment: "throw new Error('fixture')", tal: "", fischer: "" }),
  );
  expect(() => verifyStrengthGame(game, row)).not.toThrow();
  for (const patch of [
    { opponent: { ...game.failureEvidence!.request.opponent, seed: 999 } },
    { history: [toFEN(START())] },
  ]) {
    const changed = structuredClone(game);
    Object.assign(changed.failureEvidence!.request, patch);
    expect(() => verifyStrengthGame(changed, row)).toThrow(/failure evidence/i);
  }
});

it("retains a false reply as invalid evidence instead of reporting a capacity timeout", async () => {
  const { playStrengthGame } = await import("../../scripts/engine-bench/strength-match");
  const row = strengthSchedule("development", "tal", "casual", "tal")[0];
  const game = await playStrengthGame(
    row,
    workerChooser(row, {
      experiment: "self.onmessage=()=>self.postMessage(false)",
      tal: "",
      fischer: "",
    }),
  );
  expect(game).toMatchObject({
    failure: "Invalid worker reply identity",
    failureEvidence: { stage: "reply-validation", reply: false },
  });
}, 20000);
