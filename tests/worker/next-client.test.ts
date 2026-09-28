import { afterEach, expect, it, vi } from "vitest";
import { fromFEN } from "../../src/engine/board";
import { searchNextShortlistReuse } from "../../src/engine/next/shortlist-reuse-search";
import { NextEngineClient } from "../../src/worker/next/client";
import { NEXT_WORKER_POLICY, type NextRequest } from "../../src/worker/next/protocol";
class Port {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  posted: NextRequest[] = [];
  terminated = false;
  postMessage(request: NextRequest) {
    this.posted.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  reply(result: unknown, changes = {}) {
    const { requestId, gameId, revision } = this.posted[0];
    this.onmessage?.({
      data: { requestId, gameId, revision, ok: true, result, ...changes },
    } as MessageEvent);
  }
}
const input = () => ({
  gameId: "next-game",
  revision: 4,
  position: fromFEN("4k3/8/2p5/3p4/4Q3/8/8/4K3 w - - 0 1"),
  history: [] as string[],
  policy: NEXT_WORKER_POLICY,
  level: "casual" as const,
});
function result() {
  return searchNextShortlistReuse(input().position, [], {
    maxDepth: 8,
    ms: 200,
    maxNodes: 2000,
    now: () => 0,
  });
}
function setup() {
  const ports: Port[] = [];
  const client = new NextEngineClient(() => {
    const port = new Port();
    ports.push(port);
    return port;
  });
  return { client, ports };
}
afterEach(() => vi.useRealTimers());
it("accepts complete evidence, clones input and ignores stale identity", async () => {
  const { client, ports } = setup(),
    source = input();
  const pending = client.request(source);
  source.history.push("changed");
  source.position.halfmove = 50;
  expect(ports[0].posted[0].history).toEqual([]);
  expect(ports[0].posted[0].position.halfmove).toBe(0);
  const evidence = result();
  expect(evidence.kind).toBe("completed");
  ports[0].reply(evidence, { revision: 3 });
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  ports[0].reply(evidence);
  expect(await pending).toEqual(evidence);
  expect(ports[0].terminated).toBe(true);
  client.dispose();
});
it("returns ordinary incompletion without retrying or inventing a move", async () => {
  const { client, ports } = setup(),
    pending = client.request(input());
  const evidence = searchNextShortlistReuse(input().position, [], {
    maxDepth: 8,
    ms: 0,
    now: () => 0,
  });
  ports[0].reply(evidence);
  expect(await pending).toMatchObject({ kind: "incomplete", move: null, score: null });
  expect(ports).toHaveLength(1);
  client.dispose();
});
it.each(["policy", "history", "settings", "candidate", "score", "kind"])(
  "rejects corrupted %s evidence after one retry",
  async (field) => {
    const { client, ports } = setup(),
      pending = client.request(input());
    const rejected = expect(pending).rejects.toThrow(/failed/i);
    const evidence = structuredClone(result());
    if (field === "policy") Object.assign(evidence, { policy: "old" });
    if (field === "history") evidence.history = "old";
    if (field === "settings") evidence.settings.candidateWindowCp = 0;
    if (field === "candidate") evidence.candidates[0].move = { from: [0, 0], to: [0, 0] } as never;
    if (field === "score") Object.assign(evidence, { score: Infinity });
    if (field === "kind") Object.assign(evidence, { kind: "invented" });
    ports[0].reply(evidence);
    expect(ports).toHaveLength(2);
    ports[1].reply(evidence);
    await rejected;
    client.dispose();
  },
);
it("terminates superseded work and ignores the old worker", async () => {
  const { client, ports } = setup(),
    first = client.request(input());
  const aborted = expect(first).rejects.toMatchObject({ name: "AbortError" });
  const second = client.request({ ...input(), revision: 5 });
  await aborted;
  expect(ports[0].terminated).toBe(true);
  ports[0].reply(result());
  ports[1].reply(result());
  expect((await second).kind).toBe("completed");
  client.dispose();
  await expect(client.request(input())).rejects.toThrow(/disposed/i);
});
it("bounds crash and watchdog retry and releases every timer", async () => {
  vi.useFakeTimers();
  const { client, ports } = setup(),
    pending = client.request(input());
  const rejected = expect(pending).rejects.toThrow(/failed/i);
  ports[0].onerror?.({ preventDefault() {} } as ErrorEvent);
  expect(ports).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1201);
  await rejected;
  expect(ports.every((port) => port.terminated)).toBe(true);
  client.dispose();
  expect(vi.getTimerCount()).toBe(0);
});

it("can cancel during retry without reviving the replaced worker", async () => {
  const { client, ports } = setup(),
    pending = client.request(input());
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  ports[0].onmessageerror?.({} as MessageEvent);
  expect(ports).toHaveLength(2);
  client.cancel();
  await rejected;
  ports[1].reply(result());
  ports[0].onerror?.({ preventDefault() {} } as ErrorEvent);
  expect(ports).toHaveLength(2);
  expect(ports.every((port) => port.terminated)).toBe(true);
  client.dispose();
});
