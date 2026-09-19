import { expect, test, vi } from "vitest";
import { createEngineWorker, EngineClient, type WorkerPort } from "../../src/worker/client";
import { START, legalMoves, sameMove } from "../../src/engine/board";
import { ROSTER_IDS, rosterConfig } from "../../src/engine/opponents";
import type { EngineRequest, EngineReply } from "../../src/worker/protocol";
import { executeRosterRequest } from "../../src/engine/roster/worker";
import { chooseSpasskyMove } from "../../src/engine/roster/spassky";
const ai = (id: "spassky" | "tal" | "fischer"): EngineRequest => ({
  type: "ai",
  requestId: 1,
  gameId: "roster",
  revision: 2,
  position: START(),
  level: "casual",
  bookSans: [],
  opponent: rosterConfig(id, 7),
  ply: 0,
});
class Port implements WorkerPort {
  onmessage: ((e: MessageEvent<EngineReply>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  requests: EngineRequest[] = [];
  terminated = false;
  postMessage(request: EngineRequest) {
    this.requests.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  reply() {
    const r = this.requests[0];
    this.onmessage?.({
      data: { ...r, ok: true, result: { move: legalMoves(r.position)[0], score: 0, depth: 0 } },
    } as MessageEvent<EngineReply>);
  }
}
test("factory routes only exact roster AI and keeps review/search in the old worker", () => {
  const urls: string[] = [];
  vi.stubGlobal(
    "Worker",
    class extends Port {
      constructor(url: URL) {
        super();
        urls.push(url.pathname);
      }
    },
  );
  try {
    for (const id of ROSTER_IDS) {
      createEngineWorker(ai(id));
      expect(urls.at(-1)).toContain(`${id}.worker.ts`);
    }
    const r = ai("tal");
    if (r.type !== "ai") throw Error();
    createEngineWorker({ ...r, opponent: { ...r.opponent, version: 2 } });
    expect(urls.at(-1)).toContain("engine.worker.ts");
    createEngineWorker({
      type: "search",
      requestId: 2,
      gameId: "g",
      revision: 1,
      position: START(),
      ms: 10,
      depth: 1,
    });
    expect(urls.at(-1)).toContain("engine.worker.ts");
  } finally {
    vi.unstubAllGlobals();
  }
});
test("dedicated entry refuses other identities and neutral review", () => {
  expect(() => executeRosterRequest("spassky", chooseSpasskyMove, ai("tal"))).toThrow(/identity/);
  expect(() =>
    executeRosterRequest("spassky", chooseSpasskyMove, {
      type: "search",
      requestId: 1,
      gameId: "g",
      revision: 0,
      position: START(),
      ms: 10,
      depth: 1,
    }),
  ).toThrow(/identity/);
  const result = executeRosterRequest("spassky", chooseSpasskyMove, ai("spassky"));
  expect(legalMoves(START()).some((m) => sameMove(m, result.move!))).toBe(true);
});
test("retry preserves exact factory request and cancellation rejects late replies across opponent changes", async () => {
  const ports: Port[] = [],
    requests: EngineRequest[] = [];
  const client = new EngineClient((r) => {
    requests.push(r);
    const port = new Port();
    ports.push(port);
    return port;
  });
  const first = client.request(ai("spassky"));
  const aborted = expect(first).rejects.toMatchObject({ name: "AbortError" });
  ports[0].onerror?.({ preventDefault() {} } as ErrorEvent);
  expect(requests[1]).toEqual(requests[0]);
  expect(ports[0].terminated).toBe(true);
  const second = client.request(ai("tal"));
  await aborted;
  expect(ports[1].terminated).toBe(true);
  let complete = false;
  void second.then(() => (complete = true));
  ports[0].reply();
  ports[1].reply();
  await Promise.resolve();
  expect(complete).toBe(false);
  ports[2].reply();
  expect((await second).score).toBe(0);
  expect(requests[2].type === "ai" && requests[2].opponent.id).toBe("tal");
  client.dispose();
  expect(ports[2].terminated).toBe(true);
});
