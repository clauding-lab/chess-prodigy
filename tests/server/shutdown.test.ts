// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import request from "supertest";
import { expect, it, vi } from "vitest";
import { createTestApplication } from "./http-fixture";
const fake = vi.hoisted(() => ({ send: vi.fn<() => Promise<void>>() }));
vi.mock("../../server/notification-delivery", () => ({
  createNotificationDelivery: () => ({
    emailEnabled: true,
    pushPublicKey: null,
    sendEmail: fake.send,
    sendPush: async () => {},
  }),
}));
it("application close awaits an in-flight fake notification before closing SQLite and stops chat timers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "chess-shutdown-"));
  const path = join(directory, "test.sqlite");
  let release!: () => void;
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  fake.send.mockImplementation(() => delivery);
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const application = await createTestApplication({
    databasePath: path,
    baseURL: "http://localhost:4317",
    secret: "shutdown-test-secret-with-at-least-32-chars",
    notifications: true,
  });
  let closing: Promise<void> | undefined;
  try {
    const agent = request.agent(application.app);
    const signed = await agent
      .post("/api/auth/sign-up/email")
      .set("Origin", "http://localhost:4317")
      .send({
        name: "Synthetic",
        email: "synthetic@example.test",
        password: "synthetic test password only",
      })
      .expect(200);
    const opponent = await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "http://localhost:4317")
      .send({
        name: "Opponent",
        email: "opponent@example.test",
        password: "synthetic test password only",
      })
      .expect(200);
    const db = new Database(path);
    try {
      db.prepare(
        "INSERT INTO mp_games(id,creator_id,white_id,black_id,status,revision,turn_revision,state_json,token_hash,created_at,expires_at) VALUES(?,?,?,?, 'active',1,1,?,?,0,9999999999999)",
      ).run(
        "g",
        signed.body.user.id,
        signed.body.user.id,
        opponent.body.user.id,
        '{"st":{"turn":"w"}}',
        "synthetic-token",
      );
      db.prepare(
        "INSERT INTO mp_events(game_id,revision,user_id,kind,due_at) VALUES('g',1,?,'reminder',0)",
      ).run(signed.body.user.id);
    } finally {
      db.close();
    }
    await vi.advanceTimersByTimeAsync(15000);
    expect(fake.send).toHaveBeenCalledTimes(1);
    let closed = false;
    closing = application.close().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed).toBe(false);
    release();
    await closing;
    expect(closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const restored = new Database(path, { readonly: true });
    try {
      expect(restored.prepare("SELECT status FROM notification_jobs").pluck().all()).toEqual([
        "sent",
      ]);
    } finally {
      restored.close();
    }
  } finally {
    release();
    await (closing ?? application.close());
    vi.useRealTimers();
    await rm(directory, { recursive: true, force: true });
  }
});
