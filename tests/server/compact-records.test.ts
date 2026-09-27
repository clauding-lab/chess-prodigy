// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import Database from "better-sqlite3";
import { archiveGame } from "../../src/game/archive";
import { playLine, FOOLS_MATE } from "../game/play-line";
import { expect, it } from "vitest";
import { createTestApplication } from "./http-fixture";
import { encodeCompactSession, decodeCompactSession } from "../../src/storage/compact";
import { freshSession, reduceSession } from "../../src/game/state";
import { longGame } from "../storage/long-game";
const origin = "http://localhost:4317";
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "chess-compact-api-"));
  const application = await createTestApplication({
    databasePath: join(directory, "db.sqlite"),
    baseURL: origin,
    secret: "compact-record-test-secret-at-least-32-characters",
  });
  const agent = request.agent(application.app);
  const response = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({ name: "Synthetic", email: "compact@example.test", password: "synthetic password only" })
    .expect(200);
  agent.set("X-Chess-Account", response.body.user.id);
  return {
    agent,
    databasePath: join(directory, "db.sqlite"),
    userId: response.body.user.id as string,
    close: async () => {
      await application.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
it("acknowledges a formerly oversized reviewed save exactly in compact format and protects its policy floor", async () => {
  const f = await fixture();
  try {
    const old = longGame(250, true);
    for (let i = 0; i < 572; i++) old.game.keys[`obsolete-${i}`] = 0;
    expect(Buffer.byteLength(JSON.stringify(old))).toBeGreaterThan(256 * 1024);
    await f.agent
      .put("/api/records")
      .set("Origin", origin)
      .send({ expectedVersion: 0, snapshot: old })
      .expect(400);
    const compact = encodeCompactSession(old);
    const result = await f.agent
      .put("/api/records")
      .set("Origin", origin)
      .set("X-Chess-Rating-Policy", "6")
      .send({ expectedVersion: 0, snapshot: compact })
      .expect(200);
    expect(result.body.snapshot).toEqual(compact);
    expect(decodeCompactSession(result.body.snapshot)?.rating).toEqual(old.rating);
    expect(result.body.games[0].moves).toHaveLength(250);
    const reset = encodeCompactSession(reduceSession(old, { type: "resetRating" }));
    await f.agent
      .put("/api/records")
      .set("Origin", origin)
      .set("X-Chess-Rating-Policy", "6")
      .send({ expectedVersion: 1, snapshot: reset })
      .expect(200);
    for (const expectedVersion of [0, 2]) {
      const stale = await f.agent
        .put("/api/records")
        .set("Origin", origin)
        .set("X-Chess-Rating-Policy", "5")
        .send({ expectedVersion, snapshot: freshSession(0, "stale") })
        .expect(426);
      expect(stale.body).not.toHaveProperty("current");
    }
    expect((await f.agent.get("/api/records").expect(200)).body.snapshot).toEqual(reset);
  } finally {
    await f.close();
  }
});
it("archives a legal 501-half-move game in compact format and rejects over-limit bodies", async () => {
  const f = await fixture();
  try {
    const compact = encodeCompactSession(longGame(501));
    const result = await f.agent
      .put("/api/records")
      .set("Origin", origin)
      .set("X-Chess-Rating-Policy", "6")
      .send({ expectedVersion: 0, snapshot: compact })
      .expect(200);
    expect(result.body.games[0].moves).toHaveLength(501);
    await f.agent
      .put("/api/records")
      .set("Origin", origin)
      .set("X-Chess-Rating-Policy", "6")
      .send({
        expectedVersion: 1,
        snapshot: { ...compact, extra: "x".repeat(2 * 1024 * 1024 + 16384) },
      })
      .expect(413);
    expect((await f.agent.get("/api/records")).body.version).toBe(1);
  } finally {
    await f.close();
  }
});

it("transactionally restores a displaced archive after a rated mate is undone", async () => {
  const f = await fixture();
  const db = new Database(f.databasePath);
  try {
    const done = playLine(freshSession(300000, "current"), FOOLS_MATE, 300001);
    const template = archiveGame(done)!;
    const insert = db.prepare(
      "INSERT INTO game_records(user_id, game_id, record, completed_at) VALUES (?, ?, ?, ?)",
    );
    for (let i = 0; i < 200; i++) {
      const record = {
        ...template,
        id: i === 0 ? "B" : i === 1 ? "a" : `z-${i}`,
        completedAt: new Date(0).toISOString(),
      };
      insert.run(f.userId, record.id, JSON.stringify(record), record.completedAt);
    }
    const put = (expectedVersion: number, snapshot: typeof done) =>
      f.agent
        .put("/api/records")
        .set("Origin", origin)
        .set("X-Chess-Rating-Policy", "6")
        .send({ expectedVersion, snapshot: encodeCompactSession(snapshot) });
    const saved = await put(0, done).expect(200);
    expect(saved.body.games).toHaveLength(200);
    expect(saved.body.games.some((g: { id: string }) => g.id === "B")).toBe(false);
    const undo = reduceSession(done, { type: "undo", now: 300010 });
    db.exec(
      "CREATE TRIGGER fail_restore BEFORE INSERT ON game_records WHEN NEW.game_id = 'B' BEGIN SELECT RAISE(ABORT, 'synthetic restore fault'); END",
    );
    await put(1, undo).expect(500);
    expect((await f.agent.get("/api/records")).body.version).toBe(1);
    db.exec("DROP TRIGGER fail_restore");
    const restored = await put(1, undo).expect(200);
    expect(restored.body.games).toHaveLength(200);
    expect(restored.body.games.some((g: { id: string }) => g.id === "B")).toBe(true);
    expect(restored.body.games.some((g: { id: string }) => g.id === "current")).toBe(false);
    expect(restored.body.snapshot.rating.games).toBe(0);
    expect((await f.agent.get("/api/records")).body.games).toEqual(restored.body.games);
  } finally {
    db.close();
    await f.close();
  }
});
