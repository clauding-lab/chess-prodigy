import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

function context() {
  let finish!: () => void;
  const started: number[] = [];
  const ctx = {
    state: "suspended",
    currentTime: 7,
    destination: {},
    resume: () =>
      new Promise<void>((resolve) => {
        finish = () => {
          ctx.state = "running";
          resolve();
        };
      }),
    createOscillator: () => ({
      connect() {},
      disconnect() {},
      frequency: { value: 0 },
      type: "sine",
      onended: null,
      start: (at: number) => started.push(at),
      stop() {},
    }),
    createGain: () => ({
      connect() {},
      disconnect() {},
      gain: { value: 0, exponentialRampToValueAtTime() {} },
    }),
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return ctx;
      }
    },
  );
  return { ctx, started, finish: () => finish() };
}

it("waits for browser audio activation before scheduling a tone", async () => {
  const fake = context();
  const { playSound } = await import("../../src/game/sound");
  playSound("move", true);
  expect(fake.started).toEqual([]);
  fake.ctx.currentTime = 9;
  fake.finish();
  await vi.waitFor(() => expect(fake.started).toEqual([9]));
});

it("reports activation failure instead of claiming sound works", async () => {
  vi.useFakeTimers();
  context();
  const sound = await import("../../src/game/sound");
  expect(sound).toHaveProperty("activateSound");
  const result = sound.activateSound();
  await vi.advanceTimersByTimeAsync(2000);
  expect(await result).toBe(false);
});

it("muting cancels a tone waiting for browser permission", async () => {
  const fake = context();
  const sound = await import("../../src/game/sound");
  sound.playSound("move", true);
  expect(sound).toHaveProperty("silenceSound");
  sound.silenceSound();
  fake.finish();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(fake.started).toEqual([]);
});
