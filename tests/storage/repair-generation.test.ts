import { expect, it } from "vitest";
import { freshSession } from "../../src/game/state";
import { loadSavedState, saveState, SAVE_KEY } from "../../src/storage/store";
import { AccountSync, accountStorageKey } from "../../src/account/sync";
import { parseSessionInput } from "../../src/storage/input";
import { GUEST_HISTORY_KEY, loadGuestHistory, saveGuestProgress } from "../../src/storage/history";

it("writes compact guest v8 and history v7 while preserving all seven prior state generations", () => {
  localStorage.clear();
  const session = freshSession(0, "retained");
  for (let generation = 1; generation <= 7; generation++)
    localStorage.setItem(`chess-prodigy-state-v${generation}`, JSON.stringify(session));
  localStorage.setItem("chess-prodigy-guest-history-v6", JSON.stringify({ version: 1, games: [] }));
  const originals = Object.fromEntries(
    Array.from({ length: 7 }, (_, i) => [
      `chess-prodigy-state-v${i + 1}`,
      localStorage.getItem(`chess-prodigy-state-v${i + 1}`),
    ]),
  );
  expect(loadSavedState(localStorage, 1, "fallback").session.game.id).toBe("retained");
  expect(saveGuestProgress(localStorage, session)).toBe(true);
  expect(SAVE_KEY).toBe("chess-prodigy-state-v8");
  expect(GUEST_HISTORY_KEY).toBe("chess-prodigy-guest-history-v7");
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  expect(raw.version).toBe(3);
  expect(raw.game).not.toHaveProperty("hist");
  expect(parseSessionInput(raw)).toEqual(session);
  for (const [key, value] of Object.entries(originals))
    expect(localStorage.getItem(key)).toBe(value);
  expect(loadGuestHistory(localStorage).status).toBe("ready");
  localStorage.setItem(SAVE_KEY, "broken-new-authority");
  expect(loadSavedState(localStorage, 2, "fallback").status).toBe("corrupt");
});
it("writes compact account v8 with policy6 while preserving v7 pending raw acknowledgements", async () => {
  localStorage.clear();
  const session = freshSession(0, "old");
  const prior = JSON.stringify({
    baseVersion: 7,
    snapshot: session,
    pending: [{ snapshot: session, terminal: false, attempted: true }],
  });
  localStorage.setItem("chess-prodigy-account-v7:alice", prior);
  const wires: unknown[] = [];
  const sync = new AccountSync("alice", localStorage, async (_url, init) => {
    expect(new Headers(init?.headers).get("X-Chess-Rating-Policy")).toBe("6");
    const body = JSON.parse(String(init?.body));
    wires.push(body.snapshot);
    return new Response(
      JSON.stringify({
        version: body.expectedVersion + 1,
        snapshot: body.snapshot,
        games: [],
        updatedAt: null,
      }),
    );
  });
  sync.initialize({ version: 7, snapshot: session, games: [], updatedAt: null });
  sync.save(freshSession(1, "next"));
  await sync.flush();
  expect(sync.status()).toMatchObject({ state: "idle", pending: 0 });
  expect(wires[0]).toEqual(session);
  expect(wires[1]).toMatchObject({ version: 3, game: { id: "next" } });
  expect(accountStorageKey("alice")).toBe("chess-prodigy-account-v8:alice");
  expect(JSON.parse(localStorage.getItem(accountStorageKey("alice"))!).snapshot.version).toBe(3);
  expect(localStorage.getItem("chess-prodigy-account-v7:alice")).toBe(prior);
});
it("does not claim a compact guest write succeeded when browser quota is exhausted", () => {
  expect(
    saveState(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      freshSession(0, "safe"),
    ),
  ).toBe(false);
});

it("rejects a stale guest revision without overwriting newer progress", () => {
  localStorage.clear();
  const first = loadSavedState(localStorage, 0, "first");
  expect(saveState(localStorage, first.session, { expectedRevision: first.storageRevision })).toBe(
    true,
  );
  const second = loadSavedState(localStorage, 1, "unused");
  expect(second.storageRevision).toBe(1);
  expect(
    saveState(localStorage, freshSession(2, "newer"), { expectedRevision: second.storageRevision }),
  ).toBe(true);
  const raw = localStorage.getItem(SAVE_KEY);
  expect(
    saveState(localStorage, freshSession(3, "stale"), { expectedRevision: second.storageRevision }),
  ).toBe(false);
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
});
it("rejects stale account writers and retains their unsaved change for recovery", () => {
  localStorage.clear();
  const remote = { version: 0, snapshot: freshSession(0, "initial"), games: [], updatedAt: null };
  const first = new AccountSync("alice", localStorage);
  first.initialize(remote);
  const second = new AccountSync("alice", localStorage);
  second.initialize(remote);
  expect(second.save(freshSession(1, "newer"))).toBe(true);
  const raw = localStorage.getItem(accountStorageKey("alice"));
  expect(first.save(freshSession(2, "stale"))).toBe(false);
  expect(localStorage.getItem(accountStorageKey("alice"))).toBe(raw);
  expect(first.status().state).toBe("storage-error");
  expect(JSON.parse(first.exportRecovery()).pending[0].snapshot.game.id).toBe("stale");
});
