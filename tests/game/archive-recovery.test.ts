import { expect, it } from "vitest";
import { archiveGame } from "../../src/game/archive";
import { updateRecoverableArchive } from "../../src/game/archive-recovery";
import { freshSession, reduceSession } from "../../src/game/state";
import { playLine, FOOLS_MATE } from "./play-line";

const terminal = () => playLine(freshSession(300000, "current"), FOOLS_MATE, 300001);
const full = () =>
  Array.from({ length: 200 }, (_, i) => ({
    ...archiveGame(terminal())!,
    id: `prior-${i}`,
    completedAt: new Date(i * 1000).toISOString(),
  }));
it("restores the displaced 200th game after finish, reload and permitted undo", () => {
  const done = terminal();
  const before = full();
  const saved = updateRecoverableArchive({ games: before }, done);
  expect(saved.games).toHaveLength(200);
  expect(saved.evicted?.record.id).toBe("prior-0");
  expect(saved.evicted?.byGameId).toBe("current");
  const reloaded = JSON.parse(JSON.stringify(saved));
  expect(updateRecoverableArchive(reloaded, done)).toEqual(saved);
  const undone = updateRecoverableArchive(
    reloaded,
    reduceSession(done, { type: "undo", now: 300010 }),
  );
  expect(undone.games.map((g) => g.id).sort()).toEqual(before.map((g) => g.id).sort());
  expect(undone.evicted).toBeUndefined();
});
it("finalizes displaced recovery when moving to another game and cannot restore it from a later stale undo", () => {
  const done = terminal();
  const saved = updateRecoverableArchive({ games: full() }, done);
  const next = updateRecoverableArchive(saved, freshSession(400000, "next"));
  expect(next.evicted).toBeUndefined();
  const stale = updateRecoverableArchive(next, reduceSession(done, { type: "undo", now: 400001 }));
  expect(stale.games.some((g) => g.id === "prior-0")).toBe(false);
});
it("does not reserve recovery for terminal results that cannot be undone", () => {
  const done = reduceSession(freshSession(300000, "resigned"), { type: "forfeit", now: 300001 });
  const saved = updateRecoverableArchive({ games: full() }, done);
  expect(saved.evicted).toBeUndefined();
});

it("uses SQLite binary ID order for equal-time eviction, including mixed-case IDs", () => {
  const template = archiveGame(terminal())!;
  const records = [...Array.from({ length: 198 }, (_, i) => `z-${i}`), "a", "B"].map((id) => ({
    ...template,
    id,
    completedAt: new Date(0).toISOString(),
  }));
  const saved = updateRecoverableArchive({ games: records }, terminal());
  expect(saved.evicted?.record.id).toBe("B");
  const restored = updateRecoverableArchive(
    saved,
    reduceSession(terminal(), { type: "undo", now: 300010 }),
  );
  expect(restored.games.map((g) => g.id).sort()).toEqual(records.map((g) => g.id).sort());
});
