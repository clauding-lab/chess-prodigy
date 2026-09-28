import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "../../src/game/useGame";
import { freshSession, reduceSession } from "../../src/game/state";
import { playLine } from "./play-line";
import { saveState } from "../../src/storage/store";
import { legalMoves } from "../../src/engine/board";
import { experimentalRosterConfig } from "../../src/engine/opponents";
import type { ExperimentInput } from "../../src/worker/next/experiment-protocol";
const fake = vi.hoisted(() => ({
  jobs: [] as Array<{ input: ExperimentInput; resolve: (r: unknown) => void }>,
  cancel: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock("../../src/worker/next/experiment-client", () => ({
  ExperimentClient: class {
    request(input: ExperimentInput) {
      return new Promise((resolve) => fake.jobs.push({ input, resolve }));
    }
    cancel() {
      fake.cancel();
    }
    dispose() {
      fake.cancel();
    }
  },
}));
vi.mock("../../src/worker/client", () => ({
  EngineClient: class {
    request(input: unknown) {
      fake.legacy(input);
      return new Promise(() => {});
    }
    cancel() {}
    dispose() {}
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  localStorage.clear();
  fake.jobs = [];
  fake.cancel.mockClear();
  fake.legacy.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
function saved(timed = true) {
  let s = reduceSession(freshSession(0, "old"), {
    type: "new",
    id: "experiment",
    now: 1000,
    setup: {
      playerColor: "w",
      level: "club",
      time: timed ? "5+0" : "none",
      opponent: experimentalRosterConfig("tal", 11),
    },
  });
  s = playLine(s, ["e4"], 1000);
  s.preferences.coach = false;
  expect(saveState(localStorage, s)).toBe(true);
  return s;
}
it("resumes a saved experiment with flags off and retains board on incomplete calculation until Retry", async () => {
  const s = saved();
  vi.stubEnv("VITE_ENGINE_EXPERIMENT", "false");
  const { result, unmount } = renderHook(() => useGame(false));
  expect(fake.jobs).toHaveLength(1);
  expect(fake.legacy).not.toHaveBeenCalled();
  expect(fake.jobs[0].input.history).toHaveLength(1);
  expect(fake.jobs[0].input.turnDeadline).toBe(301000);
  await act(async () => {
    fake.jobs[0].resolve({ kind: "incomplete", move: null, score: null });
  });
  expect(result.current.game.st).toEqual(s.game.st);
  expect(result.current.game.hist).toHaveLength(1);
  expect(result.current.engineError).toMatch(/finish/i);
  expect(result.current.game.engineInterruption).not.toBeNull();
  expect(result.current.game.ratingApplied).toBeNull();
  act(() => result.current.retryEngine());
  expect(fake.jobs).toHaveLength(2);
  await act(async () => {
    fake.jobs[1].resolve({
      kind: "move",
      move: legalMoves(s.game.st)[0],
      score: 0,
      book: false,
      plan: null,
    });
    await vi.advanceTimersByTimeAsync(1001);
  });
  expect(result.current.game.hist).toHaveLength(2);
  expect(result.current.game.rated).toBe(false);
  unmount();
});
it("cancels an untimed experimental calculation on Home and ignores its late move", async () => {
  const s = saved(false);
  const { result, rerender, unmount } = renderHook(({ home }) => useGame(false, undefined, home), {
    initialProps: { home: false },
  });
  expect(fake.jobs).toHaveLength(1);
  rerender({ home: true });
  await act(async () => {
    fake.jobs[0].resolve({ kind: "move", move: legalMoves(s.game.st)[0], score: 0, book: false });
    await vi.advanceTimersByTimeAsync(1100);
  });
  expect(fake.cancel).toHaveBeenCalled();
  expect(result.current.game.hist).toHaveLength(1);
  unmount();
});
it("keeps the original timed calculation and reply deadline across Home navigation", async () => {
  const s = saved();
  const { result, rerender, unmount } = renderHook(({ home }) => useGame(false, undefined, home), {
    initialProps: { home: false },
  });
  expect(fake.jobs).toHaveLength(1);
  const cancellations = fake.cancel.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  rerender({ home: true });
  expect(fake.jobs).toHaveLength(1);
  expect(fake.cancel).toHaveBeenCalledTimes(cancellations);
  expect(fake.jobs[0].input.turnDeadline).toBe(301000);
  await act(async () => {
    fake.jobs[0].resolve({ kind: "move", move: legalMoves(s.game.st)[0], score: 0, book: false });
    await vi.advanceTimersByTimeAsync(599);
  });
  expect(result.current.game.hist).toHaveLength(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(result.current.game.hist).toHaveLength(2);
  rerender({ home: false });
  expect(fake.jobs).toHaveLength(1);
  expect(result.current.game.rated).toBe(false);
  unmount();
});
