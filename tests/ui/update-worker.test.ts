// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("includes uncontrolled windows when the waiting worker checks update safety", async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  let clients = [{ id: "requester", url: "https://chess.test/" }];
  const matchAll = vi.fn(async () => clients);
  runInNewContext(readFileSync("public/push-handler.js", "utf8"), {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      clients: { matchAll },
      registration: { scope: "https://chess.test/" },
    },
  });
  const query = async (source = "requester") => {
    const postMessage = vi.fn();
    let pending: Promise<void> | undefined;
    handlers.get("message")!({
      data: { kind: "chess-update-clients" },
      source: { id: source },
      ports: [{ postMessage }],
      waitUntil: (promise: Promise<void>) => {
        pending = promise;
      },
    });
    await pending;
    return postMessage.mock.calls[0][0];
  };
  expect(await query()).toEqual({ kind: "chess-update-clients", sole: true });
  clients = [...clients, { id: "old-uncontrolled", url: "https://chess.test/game/a" }];
  expect((await query()).sole).toBe(false);
  expect(matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
  clients = clients.slice(0, 1);
  expect((await query("unknown")).sole).toBe(false);
});
