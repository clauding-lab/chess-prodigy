import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { PushSubscription } from "web-push";
import type { ChessAuth } from "./auth.js";
import type { NotificationDelivery } from "./notification-delivery.js";
import { isMultiplayerEventCurrent, type MultiplayerEvent } from "./multiplayer.js";
export function initializeNotifications(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS notification_preferences(user_id TEXT PRIMARY KEY REFERENCES user(id),email INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_push(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES user(id),endpoint TEXT NOT NULL UNIQUE,subscription TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_events(event_id INTEGER PRIMARY KEY REFERENCES mp_events(id));
 CREATE TABLE IF NOT EXISTS notification_jobs(id INTEGER PRIMARY KEY,event_id INTEGER NOT NULL REFERENCES mp_events(id),channel TEXT NOT NULL,device_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,UNIQUE(event_id,channel,device_id));
 CREATE INDEX IF NOT EXISTS notification_jobs_due ON notification_jobs(status,next_at);
 CREATE TABLE IF NOT EXISTS notification_limits(user_id TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);`);
}
export function validPushSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<PushSubscription>;
  if (
    typeof s.endpoint !== "string" ||
    s.endpoint.length > 2048 ||
    !s.keys ||
    typeof s.keys.p256dh !== "string" ||
    typeof s.keys.auth !== "string"
  )
    return false;
  try {
    const u = new URL(s.endpoint);
    const allowed =
      u.hostname === "fcm.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname === "web.push.apple.com" ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname);
    return (
      allowed &&
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      /^[A-Za-z0-9_-]{86,88}={0,2}$/.test(s.keys.p256dh) &&
      Buffer.from(s.keys.p256dh, "base64url").length === 65 &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys.auth) &&
      Buffer.from(s.keys.auth, "base64url").length === 16
    );
  } catch {
    return false;
  }
}
export function createNotificationsRouter(
  db: Database.Database,
  auth: ChessAuth,
  baseURL: string,
  delivery: NotificationDelivery,
) {
  initializeNotifications(db);
  const router = Router();
  const origin = new URL(baseURL).origin;
  router.use(async (req, res, next) => {
    if (req.method !== "GET" && req.get("origin") !== origin) {
      res.status(403).json({ error: "Same-origin request required." });
      return;
    }
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session || req.get("x-chess-account") !== session.user.id) {
      res.status(401).json({ error: "Sign in again." });
      return;
    }
    res.locals.userId = session.user.id;
    if (req.method !== "GET") {
      const now = Date.now(),
        window = Math.floor(now / 60000);
      db.prepare(
        "INSERT INTO notification_limits VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END",
      ).run(session.user.id, window);
      const row = db
        .prepare("SELECT count FROM notification_limits WHERE user_id=?")
        .get(session.user.id) as { count: number };
      if (row.count > 20) {
        res
          .status(429)
          .json({ error: "Please wait a minute before changing notifications again." });
        return;
      }
    }
    next();
  });
  router.get("/config", (_req, res) =>
    res.json({ emailEnabled: delivery.emailEnabled, pushPublicKey: delivery.pushPublicKey }),
  );
  router.get("/preferences", (_req, res) => {
    const row = db
      .prepare("SELECT email FROM notification_preferences WHERE user_id=?")
      .get(res.locals.userId) as { email: number } | undefined;
    res.json({ email: row?.email !== 0 });
  });
  router.put("/preferences", (req, res) => {
    if (
      !req.body ||
      typeof req.body.email !== "boolean" ||
      Object.keys(req.body).some((k) => k !== "email")
    ) {
      res.status(400).json({ error: "Expected email preference." });
      return;
    }
    db.prepare(
      "INSERT INTO notification_preferences VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email",
    ).run(res.locals.userId, Number(req.body.email));
    res.json({ email: req.body.email });
  });
  router.post("/push", (req, res) => {
    if (!delivery.pushPublicKey) {
      res.status(503).json({ error: "Device notifications are not configured yet." });
      return;
    }
    if (!validPushSubscription(req.body)) {
      res.status(400).json({ error: "Invalid push subscription." });
      return;
    }
    const count = db
      .prepare("SELECT count(*) AS n FROM notification_push WHERE user_id=?")
      .get(res.locals.userId) as { n: number };
    const existing = db
      .prepare("SELECT user_id FROM notification_push WHERE endpoint=?")
      .get(req.body.endpoint) as { user_id: string } | undefined;
    if (existing && existing.user_id !== res.locals.userId) {
      res.status(409).json({ error: "Unsubscribe this device before changing accounts." });
      return;
    }
    if (!existing && count.n >= 8) {
      res.status(409).json({ error: "Maximum of eight devices reached." });
      return;
    }
    const s: PushSubscription = {
      endpoint: req.body.endpoint,
      keys: { p256dh: req.body.keys.p256dh, auth: req.body.keys.auth },
    };
    db.prepare(
      "INSERT INTO notification_push VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription",
    ).run(randomUUID(), res.locals.userId, s.endpoint, JSON.stringify(s));
    res.status(201).json({ enabled: true });
  });
  router.delete("/push", (req, res) => {
    if (
      !req.body ||
      typeof req.body.endpoint !== "string" ||
      req.body.endpoint.length > 2048 ||
      Object.keys(req.body).some((k) => k !== "endpoint")
    ) {
      res.status(400).json({ error: "Expected device endpoint." });
      return;
    }
    db.prepare("DELETE FROM notification_push WHERE endpoint=? AND user_id=?").run(
      req.body.endpoint,
      res.locals.userId,
    );
    res.json({ enabled: false });
  });
  return router;
}
interface Event extends MultiplayerEvent {
  id: number;
  due_at: number;
}
interface Job extends Event {
  job_id: number;
  channel: string;
  device_id: string;
  attempts: number;
}
export function createNotificationWorker(
  db: Database.Database,
  delivery: NotificationDelivery,
  options: { now?: () => number; intervalMs?: number } = {},
) {
  initializeNotifications(db);
  const now = options.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  const setStatus = (id: number, status: string) =>
    db.prepare("UPDATE notification_jobs SET status=? WHERE id=?").run(status, id);
  async function process() {
    const time = now();
    db.transaction(() => {
      const events = db
        .prepare(
          "SELECT * FROM mp_events WHERE due_at<=? AND id NOT IN (SELECT event_id FROM notification_events) ORDER BY due_at LIMIT 100",
        )
        .all(time) as Event[];
      for (const event of events) {
        db.prepare("INSERT OR IGNORE INTO notification_events VALUES(?)").run(event.id);
        if (!isMultiplayerEventCurrent(db, event)) continue;
        db.prepare(
          "INSERT OR IGNORE INTO notification_jobs(event_id,channel,device_id,next_at) VALUES(?,'email','',?)",
        ).run(event.id, time);
        const devices = db
          .prepare("SELECT id FROM notification_push WHERE user_id=?")
          .all(event.user_id) as { id: string }[];
        for (const device of devices)
          db.prepare(
            "INSERT OR IGNORE INTO notification_jobs(event_id,channel,device_id,next_at) VALUES(?,'push',?,?)",
          ).run(event.id, device.id, time);
      }
    })();
    const jobs = db
      .prepare(
        "SELECT e.*,j.id AS job_id,j.channel,j.device_id,j.attempts FROM notification_jobs j JOIN mp_events e ON e.id=j.event_id WHERE j.status='pending' AND j.next_at<=? ORDER BY j.next_at LIMIT 25",
      )
      .all(time) as Job[];
    for (const job of jobs) {
      if (stopped) break;
      if (!isMultiplayerEventCurrent(db, job)) {
        setStatus(job.job_id, "stale");
        continue;
      }
      const preference = db
        .prepare("SELECT email FROM notification_preferences WHERE user_id=?")
        .get(job.user_id) as { email: number } | undefined;
      const device =
        job.channel === "push"
          ? (db
              .prepare("SELECT subscription FROM notification_push WHERE id=? AND user_id=?")
              .get(job.device_id, job.user_id) as { subscription: string } | undefined)
          : undefined;
      if (
        (job.channel === "email" && (preference?.email === 0 || !delivery.emailEnabled)) ||
        (job.channel === "push" && (!device || !delivery.pushPublicKey))
      ) {
        setStatus(job.job_id, "disabled");
        continue;
      }
      // Reserve an attempt before IO: a process crash cannot cause unlimited retries.
      db.prepare(
        "UPDATE notification_jobs SET attempts=attempts+1,next_at=?,status=? WHERE id=?",
      ).run(time + 60000 * 2 ** job.attempts, job.attempts >= 3 ? "failed" : "pending", job.job_id);
      try {
        const message = { gameId: job.game_id, kind: job.kind };
        if (job.channel === "email") {
          // Bound reminders to an unverified address, even across multiple accounts.
          const user = db.prepare("SELECT email FROM user WHERE id=?").get(job.user_id) as
            { email: string } | undefined;
          if (!user) {
            setStatus(job.job_id, "stale");
            continue;
          }
          const key =
            "email:" + createHash("sha256").update(user.email.toLowerCase()).digest("hex");
          const window = Math.floor(time / 86400000);
          const limit = db
            .prepare("SELECT window,count FROM notification_limits WHERE user_id=?")
            .get(key) as { window: number; count: number } | undefined;
          if (limit?.window === window && limit.count >= 20) {
            setStatus(job.job_id, "limited");
            continue;
          }
          db.prepare(
            "INSERT INTO notification_limits VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END",
          ).run(key, window);
          const totalKey = "email:daily-total";
          const total = db
            .prepare("SELECT window,count FROM notification_limits WHERE user_id=?")
            .get(totalKey) as { window: number; count: number } | undefined;
          if (total?.window === window && total.count >= 250) {
            setStatus(job.job_id, "limited");
            continue;
          }
          db.prepare(
            "INSERT INTO notification_limits VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END",
          ).run(totalKey, window);
          await delivery.sendEmail(user.email, message);
        } else
          await delivery.sendPush(JSON.parse(device!.subscription) as PushSubscription, message);
        setStatus(job.job_id, "sent");
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (job.channel === "push" && [404, 410].includes(status))
          db.prepare("DELETE FROM notification_push WHERE id=?").run(job.device_id);
        if (status >= 400 && status < 500 && ![408, 429].includes(status))
          setStatus(job.job_id, "failed");
      }
    }
  }
  function tick(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (!running)
      running = process().finally(() => {
        running = undefined;
      });
    return running;
  }
  return {
    tick,
    start() {
      if (timer) return;
      stopped = false;
      timer = setInterval(() => {
        void tick().catch(() => {
          console.error("Notification worker failed; durable pending jobs will retry.");
        });
      }, options.intervalMs ?? 15000);
      timer.unref();
    },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      await running;
    },
  };
}
