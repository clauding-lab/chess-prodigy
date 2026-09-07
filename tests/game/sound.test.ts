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

it("a fresh user gesture can activate audio while an earlier resume is still blocked", async () => {
  const fake = context();
  let permitted = false;
  fake.ctx.resume = () => {
    if (!permitted) return new Promise<void>(() => {});
    fake.ctx.state = "running";
    return Promise.resolve();
  };
  const sound = await import("../../src/game/sound");
  const blocked = sound.activateSound();
  permitted = true;
  expect(await sound.activateSound()).toBe(true);
  sound.playSound("move", true);
  await vi.waitFor(() => expect(fake.started).toEqual([7]));
  await blocked;
});
