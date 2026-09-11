import { expect, it } from "vitest";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
import { freshSession, reduceSession } from "../../src/game/state";
import { archiveGame } from "../../src/game/archive";
import { legalMoves } from "../../src/engine/board";

function finished(id: string, now = 100) {
  let s = freshSession(now, id);
  s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: now + 1 });
  return reduceSession(s, { type: "resign", now: now + 2 });
}
const remote = (version = 1) => ({
  version,
  snapshot: freshSession(100, "active"),
  games: [archiveGame(finished("remote"))!],
  updatedAt: null,
});
it("persists server history outside snapshots, overlays pending terminal/undo, and survives offline restart", async () => {
  localStorage.clear();
  const sync = new AccountSync("alice", localStorage, async () => {
    throw Error("offline");
  });
  sync.initialize(remote());
  const terminal = finished("pending");
  sync.save(terminal, { terminal: true });
  sync.save(freshSession(200, "next"));
  expect(
    sync
      .history()
      .games.map((g) => g.id)
      .sort(),
  ).toEqual(["pending", "remote"]);
  expect(sync.history().pending).toBe(true);
  const reloaded = new AccountSync("alice", localStorage);
  reloaded.initialize(remote(0), false);
  expect(
    reloaded
      .history()
      .games.map((g) => g.id)
      .sort(),
  ).toEqual(["pending", "remote"]);
  const wire = JSON.parse(localStorage.getItem(accountStorageKey("alice"))!);
  expect(wire.snapshot).not.toHaveProperty("history");
  expect(
    wire.pending.every((p: { snapshot: unknown }) => !("history" in (p.snapshot as object))),
  ).toBe(true);
  reloaded.save(reduceSession(terminal, { type: "undo", now: 103 }));
  expect(reloaded.history().games.map((g) => g.id)).toEqual(["remote"]);
  expect(new AccountSync("bob", localStorage).initialize(remote()).game.id).toBe("active");
});
it("does not trim authoritative history through a transient pending terminal then undo", () => {
  localStorage.clear();
  const base = remote();
  base.games = Array.from({ length: 200 }, (_, i) => ({ ...base.games[0], id: String(i) }));
  const sync = new AccountSync("alice", localStorage);
  sync.initialize(base);
  const terminal = finished("temporary");
  sync.save(terminal, { terminal: true });
  sync.save(reduceSession(terminal, { type: "undo", now: 103 }));
  expect(sync.history().games).toHaveLength(200);
  expect(sync.history().games.some((g) => g.id === "temporary")).toBe(false);
});
it("keeps a corrupt optional history cache without invalidating valid pending progress", async () => {
  localStorage.clear();
  const s = finished("pending"),
    bad = { version: 99, games: ["do not erase"] };
  localStorage.setItem(
    accountStorageKey("alice"),
    JSON.stringify({
      baseVersion: 7,
      snapshot: s,
      pending: [{ snapshot: s, terminal: true }],
      history: bad,
    }),
  );
  let calls = 0;
  const sync = new AccountSync("alice", localStorage, async () => {
    calls++;
    throw Error("offline");
  });
  expect(sync.initialize(remote(0), false).game.id).toBe("pending");
  expect(sync.history().status).toBe("corrupt");
  await sync.flush();
  expect(calls).toBe(1);
  expect(JSON.parse(localStorage.getItem(accountStorageKey("alice"))!).history).toEqual(bad);
  expect(sync.status()).toMatchObject({ state: "offline", pending: 1 });
});
it("does not claim missing legacy caches are complete when opening offline", () => {
  localStorage.clear();
  const s = freshSession(0, "old");
  localStorage.setItem(
    accountStorageKey("alice"),
    JSON.stringify({ baseVersion: 4, snapshot: s, pending: [] }),
  );
  const sync = new AccountSync("alice", localStorage);
  sync.initialize(remote(0), false);
  expect(sync.history()).toMatchObject({ status: "incomplete", games: [] });
  sync.acceptHistory(remote(5));
  expect(sync.history()).toMatchObject({ status: "ready", games: remote(5).games });
  sync.acceptHistory({ ...remote(3), games: [] });
  expect(sync.history().games).toHaveLength(1);
  sync.dispose();
  sync.acceptHistory({ ...remote(6), games: [] });
  expect(sync.history().games).toHaveLength(1);
});

it("replaces the server history base on acknowledgements without sending cached archives", async () => {
  localStorage.clear();
  const terminal = finished("new", 200),
    accepted = {
      ...remote(2),
      snapshot: terminal,
      games: [archiveGame(terminal)!, ...remote().games],
    };
  const sync = new AccountSync("alice", localStorage, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body).sort()).toEqual(["expectedVersion", "snapshot"]);
    expect(body.snapshot).not.toHaveProperty("history");
    return new Response(JSON.stringify(accepted));
  });
  sync.initialize(remote());
  sync.save(terminal, { terminal: true });
  await sync.flush();
  expect(sync.history()).toMatchObject({ pending: false, games: accepted.games });
  const reload = new AccountSync("alice", localStorage);
  reload.initialize(remote(0), false);
  expect(reload.history().games).toEqual(accepted.games);
});

for (const choice of ["cloud", "device"] as const)
  it(`adopts conflict history for ${choice} without leaking or duplicating pending wins`, async () => {
    localStorage.clear();
    const terminal = finished("pending"),
      current = { ...remote(4), games: [archiveGame(finished("other-device"))!] };
    const sync = new AccountSync(
      "alice",
      localStorage,
      async () => new Response(JSON.stringify({ current }), { status: 409 }),
    );
    sync.initialize(remote());
    sync.save(terminal, { terminal: true });
    await sync.flush();
    expect(sync.status().state).toBe("conflict");
    if (choice === "cloud") sync.useCloud();
    else sync.keepDevice();
    expect(
      sync
        .history()
        .games.map((g) => g.id)
        .sort(),
    ).toEqual(choice === "cloud" ? ["other-device"] : ["other-device", "pending"]);
    const bob = new AccountSync("bob", localStorage);
    bob.initialize({ ...remote(), games: [] });
    expect(bob.history().games).toEqual([]);
  });
