// @vitest-environment node
import Database from "better-sqlite3";
import { afterEach, expect, it, vi } from "vitest";
import { createNotificationWorker } from "../../server/notifications";
const databases: Database.Database[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
function fixture() {
  const db = new Database(":memory:");
  databases.push(db);
  db.exec(`CREATE TABLE user(id TEXT PRIMARY KEY,email TEXT);
    CREATE TABLE mp_events(id INTEGER PRIMARY KEY,game_id TEXT,revision INTEGER,user_id TEXT,kind TEXT,due_at INTEGER);
    CREATE TABLE mp_games(id TEXT,creator_id TEXT,white_id TEXT,black_id TEXT,status TEXT,turn_revision INTEGER,state_json TEXT);`);
  const sent: string[] = [];
  const delivery = {
    emailEnabled: true,
    pushPublicKey: null,
    sendEmail: vi.fn(async (email: string) => {
      sent.push(email);
    }),
    sendPush: vi.fn(async () => {}),
  };
  let time = 600000;
  const worker = createNotificationWorker(db, delivery, { now: () => time });
  let id = 0;
  function event(recipient: string, email: string, sender = `sender-${id}`, creator = recipient) {
    const n = ++id;
    for (const [user, address] of [
      [recipient, email],
      [sender, `${sender}@example.test`],
      [creator, `${creator}@example.test`],
    ])
      db.prepare("INSERT OR IGNORE INTO user VALUES(?,?)").run(user, address);
    db.prepare("INSERT INTO mp_games VALUES(?,?,?,?, 'active',1,?)").run(
      `g${n}`,
      creator,
      recipient,
      sender,
      '{"st":{"turn":"w"}}',
    );
    db.prepare("INSERT INTO mp_events VALUES(?,?,1,?,'reminder',0)").run(n, `g${n}`, recipient);
  }
  async function drain() {
    for (let i = 0; i < 20; i++) await worker.tick();
  }
  return {
    db,
    sent,
    delivery,
    event,
    drain,
    tickAt: async (value: number) => {
      time = value;
      await worker.tick();
    },
    nextDay: () => {
      time += 86400000;
    },
  };
}
it("shares the 20-attempt inbox quota across Gmail dots, tags and googlemail without changing addresses", async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++)
    f.event(`r${i}`, `v.i.c.t.i.m+${i}@${i % 2 ? "googlemail.com" : "gmail.com"}`);
  await f.drain();
  expect(f.sent).toHaveLength(20);
  expect(f.sent[0]).toBe("v.i.c.t.i.m+0@gmail.com");
  f.event("legit", "legit@example.test");
  await f.drain();
  expect(f.sent.at(-1)).toBe("legit@example.test");
  f.nextDay();
  f.event("tomorrow", "victim+next@gmail.com");
  await f.drain();
  expect(f.sent.at(-1)).toBe("victim+next@gmail.com");
});
it("does not conflate plus tags or dots at arbitrary domains", async () => {
  const f = fixture();
  for (let i = 0; i < 21; i++) f.event(`r${i}`, `a.b+${i}@example.test`);
  await f.drain();
  expect(f.sent).toHaveLength(21);
});
it.each(["sender", "creator"])(
  "limits a single %s across many recipient accounts while leaving capacity for others",
  async (role) => {
    const f = fixture();
    for (let i = 0; i < 55; i++)
      f.event(
        `r${i}`,
        `r${i}@example.test`,
        role === "sender" ? "actor" : `s${i}`,
        role === "creator" ? "actor" : `r${i}`,
      );
    await f.drain();
    expect(f.sent).toHaveLength(40);
    f.event("legit", "legit@example.test");
    await f.drain();
    expect(f.sent.at(-1)).toBe("legit@example.test");
  },
);
it("enforces account limits even if the stored login address changes", async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.event("a", "a@example.test");
  await f.drain();
  f.db.prepare("UPDATE user SET email=? WHERE id='a'").run("other@example.test");
  f.event("a", "other@example.test");
  await f.drain();
  expect(f.sent).toHaveLength(20);
});
it("retains the global daily budget without charging denied recipients", async () => {
  const f = fixture();
  for (let i = 0; i < 251; i++) f.event(`r${i}`, `r${i}@example.test`);
  await f.drain();
  expect(f.sent).toHaveLength(250);
  expect(
    f.db.prepare("SELECT count FROM notification_limits WHERE user_id='email:account:r250'").get(),
  ).toBeUndefined();
  expect(
    f.db.prepare("SELECT count(*) AS n FROM notification_jobs WHERE status='limited'").get(),
  ).toEqual({ n: 1 });
});

it.each(["sender", "creator"])(
  "shares the %s budget across known Gmail mailbox aliases",
  async (role) => {
    const f = fixture();
    for (let i = 0; i < 45; i++) {
      f.event(`r${i}`, `r${i}@example.test`, `s${i}`, `c${i}`);
      f.db
        .prepare("UPDATE user SET email=? WHERE id=?")
        .run(`a.c.t.o.r+${i}@gmail.com`, `${role === "sender" ? "s" : "c"}${i}`);
    }
    await f.drain();
    expect(f.sent).toHaveLength(40);
  },
);
it("caps started events caused by one joiner across different creators", async () => {
  const f = fixture();
  for (let i = 0; i < 45; i++) f.event(`r${i}`, `r${i}@example.test`, "joiner");
  f.db.exec("UPDATE mp_events SET kind='started'");
  await f.drain();
  expect(f.sent).toHaveLength(40);
});
it("counts failed sends durably and reserves no partial quota when another budget is full", async () => {
  const f = fixture();
  f.delivery.sendEmail.mockRejectedValue(new Error("fake provider outage"));
  for (let i = 0; i < 10; i++) f.event("a", "a@example.test");
  await f.drain();
  await f.tickAt(660000);
  const restarted = createNotificationWorker(f.db, f.delivery, { now: () => 900000 });
  await restarted.tick();
  expect(f.delivery.sendEmail).toHaveBeenCalledTimes(20);
  expect(
    f.db.prepare("SELECT count(*) AS n FROM notification_jobs WHERE status='limited'").get(),
  ).toEqual({ n: 10 });
  expect(
    f.db.prepare("SELECT count FROM notification_limits WHERE user_id='email:daily-total'").get(),
  ).toEqual({ count: 20 });
  f.delivery.sendEmail.mockImplementation(async (email: string) => {
    f.sent.push(email);
  });
  f.event("legit", "legit@example.test");
  await f.drain();
  expect(f.sent).toEqual(["legit@example.test"]);
});

it("keeps dotted and undotted mailboxes distinct outside consumer Gmail", async () => {
  const f = fixture();
  for (let i = 0; i < 22; i++) f.event(`r${i}`, i % 2 ? "a.b@example.test" : "ab@example.test");
  await f.drain();
  expect(f.sent).toHaveLength(22);
});
