import { it, expect, vi } from "vitest";
import { EngineClient } from "../../src/worker/client";
import { START } from "../../src/engine/board";
import type { EngineRequest } from "../../src/worker/protocol";
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  posted: EngineRequest[] = [];
  postMessage(r: EngineRequest) {
    this.posted.push(r);
  }
  terminate() {
    this.terminated = true;
  }
  reply(value: unknown) {
    this.onmessage?.({ data: value } as MessageEvent);
  }
}
const input = {
  type: "search" as const,
  gameId: "g1",
  revision: 0,
  position: START(),
  ms: 100,
  depth: 2,
};
it("ignores stale reply identity and resolves the matching request", async () => {
  const w = new FakeWorker();
  const client = new EngineClient(() => w);
  const promise = client.request(input);
  const req = w.posted[0];
  w.reply({ ...req, gameId: "old", ok: true, result: { move: null, score: 99, depth: 2 } });
  let done = false;
  void promise.then(() => (done = true));
  await Promise.resolve();
  expect(done).toBe(false);
  w.reply({ ...req, ok: true, result: { move: null, score: 12, depth: 2 } });
  expect((await promise).score).toBe(12);
  client.dispose();
});
it("cancellation terminates work and rejects its promise", async () => {
  const w = new FakeWorker();
  const client = new EngineClient(() => w);
  const promise = client.request(input);
  const assertion = expect(promise).rejects.toMatchObject({ name: "AbortError" });
  client.cancel();
  await assertion;
  expect(w.terminated).toBe(true);
  client.dispose();
});
it("retries one crash and exposes a second failure", async () => {
  const workers: FakeWorker[] = [];
  const client = new EngineClient(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  const promise = client.request(input);
  const rejection = expect(promise).rejects.toThrow(/failed/i);
  workers[0].onerror?.({ preventDefault() {} } as ErrorEvent);
  expect(workers).toHaveLength(2);
  workers[1].onerror?.({ preventDefault() {} } as ErrorEvent);
  await rejection;
  client.dispose();
});
it("watchdog retries once and releases all timers", async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const client = new EngineClient(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  const promise = client.request(input);
  const rejection = expect(promise).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(2202);
  await rejection;
  expect(workers).toHaveLength(2);
  client.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

it("rejects an opponent result masquerading as a neutral worker reply", async () => {
  const { REVIEWER } = await import("../../src/engine/reviewer");
  const workers: FakeWorker[] = [];
  const client = new EngineClient(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  const pending = client.request({
    type: "analyse",
    reviewer: REVIEWER,
    policy: "review-v1",
    history: [],
    gameId: "neutral",
    revision: 0,
    position: START(),
  });
  const rejection = expect(pending).rejects.toThrow(/failed/i);
  workers[0].reply({
    ...workers[0].posted[0],
    ok: true,
    result: { move: null, score: 9999, book: false },
  });
  workers[1].reply({
    ...workers[1].posted[0],
    ok: true,
    result: { move: null, score: 9999, depth: 3 },
  });
  await rejection;
  client.dispose();
});
