// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
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
