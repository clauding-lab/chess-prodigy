// @vitest-environment node
import Database from "better-sqlite3";
import { describe, it, expect, vi } from "vitest";
import {
  createNotificationWorker,
  initializeNotifications,
  validPushSubscription,
} from "../../server/notifications";
import type { NotificationDelivery } from "../../server/notification-delivery";
function fixture() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE user(id TEXT PRIMARY KEY,email TEXT); INSERT INTO user VALUES('a','a@example.com');
 CREATE TABLE mp_events(id INTEGER PRIMARY KEY,game_id TEXT,revision INTEGER,user_id TEXT,kind TEXT,due_at INTEGER);
 CREATE TABLE mp_games(id TEXT,creator_id TEXT,white_id TEXT,black_id TEXT,status TEXT,turn_revision INTEGER,state_json TEXT);
 INSERT INTO mp_games VALUES('g','a','a','b','active',1,'{"st":{"turn":"w"}}');
 INSERT INTO mp_events VALUES(1,'g',1,'a','reminder',600000);`);
  initializeNotifications(db);
  const delivery: NotificationDelivery = {
    emailEnabled: true,
    pushPublicKey: null,
    sendEmail: vi.fn(async () => {}),
    sendPush: vi.fn(async () => {}),
  };
  return { db, delivery };
}
describe("durable notification worker", () => {
  it("waits ten minutes and sends each channel once across restart", async () => {
    const { db, delivery } = fixture();
    let now = 599999;
    const worker = createNotificationWorker(db, delivery, { now: () => now });
    await worker.tick();
    expect(delivery.sendEmail).not.toHaveBeenCalled();
    now++;
    await worker.tick();
    await worker.tick();
    await createNotificationWorker(db, delivery, { now: () => now }).tick();
    expect(delivery.sendEmail).toHaveBeenCalledTimes(1);
    db.close();
  });
  it("discards obsolete turns and respects email preferences", async () => {
    const { db, delivery } = fixture();
    db.prepare("UPDATE mp_games SET turn_revision=2").run();
    await createNotificationWorker(db, delivery, { now: () => 600000 }).tick();
    expect(delivery.sendEmail).not.toHaveBeenCalled();
    db.close();
    const next = fixture();
    next.db.prepare("INSERT INTO notification_preferences VALUES(?,?)").run("a", 0);
    await createNotificationWorker(next.db, next.delivery, { now: () => 600000 }).tick();
    expect(next.delivery.sendEmail).not.toHaveBeenCalled();
    next.db.close();
  });
  it("persists bounded retries across worker restarts", async () => {
    const { db, delivery } = fixture();
    vi.mocked(delivery.sendEmail).mockRejectedValue(new Error("temporary"));
    for (let i = 0; i < 8; i++)
      await createNotificationWorker(db, delivery, { now: () => 600000 + i * 3600000 }).tick();
    expect(delivery.sendEmail).toHaveBeenCalledTimes(4);
    expect(db.prepare("SELECT status FROM notification_jobs").get()).toEqual({ status: "failed" });
    db.close();
  });
  it("rejects private, lookalike and non-HTTPS push endpoints", () => {
    const keys = {
      p256dh: Buffer.alloc(65, 1).toString("base64url"),
      auth: Buffer.alloc(16, 1).toString("base64url"),
    };
    for (const endpoint of [
      "http://fcm.googleapis.com/x",
      "https://localhost/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://fcm.googleapis.com:444/x",
      "https://user@fcm.googleapis.com/x",
    ])
      expect(validPushSubscription({ endpoint, keys })).toBe(false);
    expect(
      validPushSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/test", keys }),
    ).toBe(true);
  });
});

import express from "express";
import { listenForTest } from "./http-fixture";
import request from "supertest";
import type { ChessAuth } from "../../server/auth";
import { createNotificationsRouter } from "../../server/notifications";
import { DeliveryError } from "../../server/notification-delivery";
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  keys: {
    p256dh: Buffer.alloc(65, 1).toString("base64url"),
    auth: Buffer.alloc(16, 1).toString("base64url"),
  },
};
it("protects preferences and device ownership with session, origin and expected account", async () => {
  const { db, delivery } = fixture();
  delivery.pushPublicKey = "configured";
  let userId = "a";
  const auth = {
    api: { getSession: async () => ({ user: { id: userId } }) },
  } as unknown as ChessAuth;
  const router = express();
  router.use(express.json());
  router.use(
    "/api/notifications",
    createNotificationsRouter(db, auth, "https://chess.example", delivery),
  );
  const app = await listenForTest(router);
  await request(app).get("/api/notifications/preferences").expect(401);
  await request(app)
    .put("/api/notifications/preferences")
    .set("x-chess-account", "a")
    .send({ email: false })
    .expect(403);
  await request(app)
    .post("/api/notifications/push")
    .set("origin", "https://chess.example")
    .set("x-chess-account", "a")
    .send(subscription)
    .expect(201);
  userId = "b";
  await request(app)
    .delete("/api/notifications/push")
    .set("origin", "https://chess.example")
    .set("x-chess-account", "b")
    .send({ endpoint: subscription.endpoint })
    .expect(200);
  expect(db.prepare("SELECT user_id FROM notification_push").get()).toEqual({ user_id: "a" });
  await request(app)
    .post("/api/notifications/push")
    .set("origin", "https://chess.example")
    .set("x-chess-account", "b")
    .send(subscription)
    .expect(409);
  userId = "a";
  await request(app)
    .put("/api/notifications/preferences")
    .set("origin", "https://chess.example")
    .set("x-chess-account", "a")
    .send({ email: false })
    .expect(200);
  await request(app)
    .get("/api/notifications/preferences")
    .set("x-chess-account", "a")
    .expect(200, { email: false });
  await request(app)
    .delete("/api/notifications/push")
    .set("origin", "https://chess.example")
    .set("x-chess-account", "a")
    .send({ endpoint: subscription.endpoint })
    .expect(200);
  expect(db.prepare("SELECT count(*) AS n FROM notification_push").get()).toEqual({ n: 0 });
  db.close();
});
it("sends once per enabled device and removes an expired subscription", async () => {
  const { db, delivery } = fixture();
  delivery.pushPublicKey = "configured";
  db.prepare("INSERT INTO notification_push VALUES(?,?,?,?)").run(
    "d1",
    "a",
    subscription.endpoint,
    JSON.stringify(subscription),
  );
  db.prepare("INSERT INTO notification_push VALUES(?,?,?,?)").run(
    "d2",
    "a",
    subscription.endpoint + "2",
    JSON.stringify({ ...subscription, endpoint: subscription.endpoint + "2" }),
  );
  vi.mocked(delivery.sendPush).mockRejectedValueOnce(new DeliveryError(410));
  const worker = createNotificationWorker(db, delivery, { now: () => 600000 });
  await worker.tick();
  await worker.tick();
  expect(delivery.sendPush).toHaveBeenCalledTimes(2);
  expect(delivery.sendEmail).toHaveBeenCalledTimes(1);
  expect(db.prepare("SELECT id FROM notification_push").all()).toEqual([{ id: "d2" }]);
  db.close();
});
it("cancels stale retries after restart and waits for an active send during shutdown", async () => {
  const { db, delivery } = fixture();
  vi.mocked(delivery.sendEmail).mockRejectedValueOnce(new Error("timeout"));
  await createNotificationWorker(db, delivery, { now: () => 600000 }).tick();
  db.prepare("UPDATE mp_games SET turn_revision=2").run();
  await createNotificationWorker(db, delivery, { now: () => 700000 }).tick();
  expect(delivery.sendEmail).toHaveBeenCalledTimes(1);
  db.close();
  const next = fixture();
  let release!: () => void;
  vi.mocked(next.delivery.sendEmail).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const worker = createNotificationWorker(next.db, next.delivery, { now: () => 600000 });
  const tick = worker.tick();
  let stopped = false;
  const stop = worker.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  expect(stopped).toBe(false);
  release();
  await tick;
  await stop;
  expect(stopped).toBe(true);
  next.db.close();
});
