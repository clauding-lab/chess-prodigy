// @vitest-environment node
import Database from "better-sqlite3";
import express from "express";
import { listenForTest } from "./http-fixture";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createAuth } from "../../server/auth";
import { createMultiplayerRouter, isMultiplayerEventCurrent } from "../../server/multiplayer";
import { sqIndex } from "../../src/engine/board";

const origin = "http://localhost:4317";
const databases: Database.Database[] = [];
const closeChats: (() => void)[] = [];
afterEach(() => {
  closeChats.splice(0).forEach((close) => close());
  databases.splice(0).forEach((db) => db.close());
});
async function fixture() {
  const db = new Database(":memory:");
  databases.push(db);
  const auth = await createAuth({
    database: db,
    baseURL: origin,
    secret: "multiplayer-test-secret-at-least-32-characters",
  });
  const router = express();
  router.use(express.json());
  const multiplayer = createMultiplayerRouter(db, auth, origin);
  closeChats.push(multiplayer.closeChat);
  router.use("/mp", multiplayer);
  const app = await listenForTest(router);
  async function player(name: string) {
    const response = await auth.api.signUpEmail({
      body: { name, email: `${name}@example.com`, password: "long safe test password" },
      asResponse: true,
    });
    const data = await response.json();
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    return {
      id: data.user.id as string,
      get: (path: string) => request(app).get(`/mp${path}`).set("Cookie", cookie),
      post: (path: string, body: unknown) =>
        request(app)
          .post(`/mp${path}`)
          .set("Cookie", cookie)
          .set("Origin", origin)
          .send(body as object),
    };
  }
  const a = await player("Alice"),
    b = await player("Bob"),
    c = await player("Chris");
  async function game() {
    const invite = await a.post("/invites", { color: "w" }).expect(201);
    const joined = await b.post("/join", { token: invite.body.token }).expect(200);
    return joined.body;
  }
  return { db, app, a, b, c, game };
}
describe("authenticated human games", () => {
  it("keeps chat participant-only, supports emoji and typing, and clears it when either player leaves", async () => {
    const { a, b, c, game } = await fixture();
    const g = await game();
    const path = `/${g.id}/chat`;
    const alice = { action: "join", clientId: "alice-chat-session" };
    const bob = { action: "join", clientId: "bob-chat-session" };
    await c.post(path, alice).expect(404);
    const joined = (await a.post(path, alice).expect(200)).body;
    await b.post(path, bob).expect(200);
    const epoch = joined.epoch;
    await a.post(path, { ...alice, action: "send", epoch, text: "Good luck! ♟️🙂" }).expect(200);
    const received = (await b.post(path, { ...bob, action: "poll" }).expect(200)).body;
    expect(received.messages).toEqual([
      expect.objectContaining({ text: "Good luck! ♟️🙂", userId: a.id }),
    ]);
    await a.post(path, { ...alice, action: "typing", epoch, typing: true }).expect(200);
    expect((await b.post(path, { ...bob, action: "poll" })).body.typing).toBe(true);
    await a.post(path, { ...alice, action: "send", epoch, text: "x".repeat(1001) }).expect(400);
    await a.post(path, { ...alice, action: "leave" }).expect(200);
    const cleared = (await b.post(path, { ...bob, action: "poll" }).expect(200)).body;
    expect(cleared.messages).toEqual([]);
    expect(cleared.typing).toBe(false);
    expect(cleared.epoch).not.toBe(epoch);
    await a.post(path, { ...alice, action: "send", epoch, text: "late message" }).expect(409);
    await a.post(path, alice).expect(409);
  });
  it("requires authentication, protects tokens and participant data, validates turns and revisions", async () => {
    const { app, a, b, c } = await fixture();
    await request(app).get("/mp").expect(401);
    const invite = await a.post("/invites", { color: "w" }).expect(201);
    await a.post("/join", { token: invite.body.token }).expect(200);
    const g = (await b.post("/join", { token: invite.body.token }).expect(200)).body;
    expect(g.yourColor).toBe("b");
    expect(g.review).toBeNull();
    await c.get(`/${g.id}`).expect(404);
    await c.post("/join", { token: invite.body.token }).expect(404);
    await b
      .post(`/${g.id}/move`, { expectedRevision: g.revision, move: { from: 52, to: 36 } })
      .expect(409);
    await a
      .post(`/${g.id}/move`, { expectedRevision: g.revision, move: { from: 0, to: 1 } })
      .expect(400);
    const next = (
      await a
        .post(`/${g.id}/move`, {
          expectedRevision: g.revision,
          move: { from: sqIndex("e2"), to: sqIndex("e4") },
        })
        .expect(200)
    ).body;
    expect(next.moves[0].san).toBe("e4");
    expect(next.position.turn).toBe("b");
    await a
      .post(`/${g.id}/move`, { expectedRevision: g.revision, move: { from: 52, to: 36 } })
      .expect(409);
    expect(JSON.stringify(next)).not.toMatch(/example.com|token|motifs/);
  });
  it("completes once with atomic Elo and private lifetime head-to-head, using current names", async () => {
    const { db, a, b, c, game, app } = await fixture();
    const g = await game();
    const done = (await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200))
      .body;
    expect(done.ratingChanges).toEqual({ white: 16, black: -16 });
    expect(done.headToHead).toMatchObject({ wins: 0, losses: 1, draws: 0 });
    await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(409);
    db.prepare("UPDATE user SET name=? WHERE id=?").run("Renamed", a.id);
    const list = (await b.get("").expect(200)).body;
    expect(list.rating).toEqual({ rating: 1184, games: 1 });
    expect(list.opponents[0].opponent.name).toBe("Renamed");
    expect((await c.get("")).body.opponents).toEqual([]);
    const publicRows = (await request(app).get("/mp/leaderboard").expect(200)).body.players;
    expect(publicRows[0]).toEqual({ rank: 1, name: "Renamed", rating: 1216, games: 1 });
    expect(JSON.stringify(publicRows)).not.toContain(a.id);
  });
  it("agrees draws only with an opponent offer and preserves the current reminder", async () => {
    const { db, a, b, game } = await fixture();
    const g = await game();
    await a.post(`/${g.id}/draw`, { expectedRevision: g.revision, action: "accept" }).expect(409);
    const offered = (
      await a.post(`/${g.id}/draw`, { expectedRevision: g.revision, action: "offer" }).expect(200)
    ).body;
    await a
      .post(`/${g.id}/draw`, { expectedRevision: offered.revision, action: "accept" })
      .expect(409);
    const done = (
      await b
        .post(`/${g.id}/draw`, { expectedRevision: offered.revision, action: "accept" })
        .expect(200)
    ).body;
    expect(done.result.result).toBe("½-½");
    expect(done.headToHead.draws).toBe(1);
    expect(done.ratingChanges).toEqual({ white: 0, black: 0 });
    expect(db.prepare("SELECT count(*) AS n FROM mp_events WHERE kind='started'").get()).toEqual({
      n: 1,
    });
  });
  it("expires and cancels unused invitations without ratings and admits only one concurrent join", async () => {
    const { db, a, b, c } = await fixture();
    const old = (await a.post("/invites", { color: "b" })).body;
    db.prepare("UPDATE mp_games SET expires_at=0 WHERE id=?").run(old.id);
    await b.post("/join", { token: old.token }).expect(404);
    const cancelled = (await a.post("/invites", { color: "random" })).body;
    await a.post(`/${cancelled.id}/cancel`, { expectedRevision: 0 }).expect(200);
    await b.post("/join", { token: cancelled.token }).expect(404);
    const invite = (await a.post("/invites", { color: "w" })).body;
    const results = await Promise.all([
      b.post("/join", { token: invite.token }),
      c.post("/join", { token: invite.token }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
    expect((await a.get("")).body.rating.games).toBe(0);
  });
  it("detects checkmate using server rules and rejects subsequent moves", async () => {
    const { a, b, game } = await fixture();
    let g = await game();
    for (const [player, from, to] of [
      [a, "f2", "f3"],
      [b, "e7", "e5"],
      [a, "g2", "g4"],
      [b, "d8", "h4"],
    ] as const) {
      g = (
        await player
          .post(`/${g.id}/move`, {
            expectedRevision: g.revision,
            move: { from: sqIndex(from), to: sqIndex(to) },
          })
          .expect(200)
      ).body;
    }
    expect(g.result).toEqual({ result: "0-1", reason: "Checkmate" });
    expect(g.review.hist).toHaveLength(4);
    await a
      .post(`/${g.id}/move`, { expectedRevision: g.revision, move: { from: 1, to: 2 } })
      .expect(409);
  });
  it("keeps one reminder per turn through draw negotiations and invalidates it after a move", async () => {
    const { db, a, b, game } = await fixture();
    let g = await game();
    const first = db.prepare("SELECT * FROM mp_events WHERE kind='reminder'").get() as {
      game_id: string;
      revision: number;
      user_id: string;
      kind: string;
      due_at: number;
    };
    expect(first.due_at).toBe(g.turnStartedAt + 600_000);
    expect(isMultiplayerEventCurrent(db, first)).toBe(true);
    g = (
      await b.post(`/${g.id}/draw`, { expectedRevision: g.revision, action: "offer" }).expect(200)
    ).body;
    g = (
      await a.post(`/${g.id}/draw`, { expectedRevision: g.revision, action: "decline" }).expect(200)
    ).body;
    expect(isMultiplayerEventCurrent(db, first)).toBe(true);
    expect(db.prepare("SELECT count(*) n FROM mp_events WHERE kind='reminder'").get()).toEqual({
      n: 1,
    });
    g = (
      await a
        .post(`/${g.id}/move`, {
          expectedRevision: g.revision,
          move: { from: sqIndex("e2"), to: sqIndex("e4") },
        })
        .expect(200)
    ).body;
    expect(isMultiplayerEventCurrent(db, first)).toBe(false);
    const second = db
      .prepare("SELECT * FROM mp_events WHERE kind='reminder' ORDER BY id DESC LIMIT 1")
      .get() as typeof first;
    expect(second.user_id).toBe(b.id);
    expect(isMultiplayerEventCurrent(db, second)).toBe(true);
    await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200);
    expect(isMultiplayerEventCurrent(db, second)).toBe(false);
  });
  it("serializes simultaneous completions using both current ratings and preserves total points", async () => {
    const { a, b, game } = await fixture();
    const first = await game(),
      second = await game();
    const responses = await Promise.all([
      b.post(`/${first.id}/resign`, { expectedRevision: first.revision }),
      b.post(`/${second.id}/resign`, { expectedRevision: second.revision }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const ar = (await a.get("")).body.rating,
      br = (await b.get("")).body.rating;
    expect(ar.games).toBe(2);
    expect(br.games).toBe(2);
    expect(ar.rating + br.rating).toBeCloseTo(2400, 10);
    expect(ar.rating).toBeGreaterThan(1230);
    expect(ar.rating).toBeLessThan(1232);
    expect((await a.get("")).body.opponents[0]).toMatchObject({ wins: 2, losses: 0, draws: 0 });
  });
  it("rejects cross-origin and stale-account writes and bounds invitation creation", async () => {
    const { a, b } = await fixture();
    await a.post("/invites", { color: "w" }).set("Origin", "https://evil.example").expect(403);
    await a.post("/invites", { color: "w" }).set("X-Chess-Account", b.id).expect(401);
    for (let i = 0; i < 5; i++) await a.post("/invites", { color: "random" }).expect(201);
    await a.post("/invites", { color: "w" }).expect(429);
  });
});

it("keeps the offerer's draw offer after their move until the opponent responds", async () => {
  const { a, b, game } = await fixture();
  const g = await game();
  const offer = (
    await a.post(`/${g.id}/draw`, { expectedRevision: g.revision, action: "offer" }).expect(200)
  ).body;
  const moved = (
    await a
      .post(`/${g.id}/move`, { expectedRevision: offer.revision, move: { from: 52, to: 36 } })
      .expect(200)
  ).body;
  expect(moved.drawOfferBy).toBe(a.id);
  const done = (
    await b
      .post(`/${g.id}/draw`, { expectedRevision: moved.revision, action: "accept" })
      .expect(200)
  ).body;
  expect(done.result.result).toBe("½-½");
});

it("does not let old expired invitations crowd a recent completed match out of the list", async () => {
  const { db, a, b, game } = await fixture();
  const g = await game();
  await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200);
  const columns = db.prepare("PRAGMA table_info(mp_games)").all() as { name: string }[];
  const names = columns.map((column) => column.name);
  const row = db.prepare("SELECT * FROM mp_games WHERE id=?").get(g.id) as Record<string, unknown>;
  const insert = db.prepare(
    `INSERT INTO mp_games (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`,
  );
  for (let i = 0; i < 201; i++) {
    const expired = {
      ...row,
      id: `expired-${i}`,
      token_hash: `hash-${i}`,
      status: "waiting",
      expires_at: 1,
      created_at: 1,
    };
    insert.run(...names.map((name) => expired[name as keyof typeof expired]));
  }
  const list = (await a.get("").expect(200)).body;
  expect(list.games.some((entry: { id: string }) => entry.id === g.id)).toBe(true);
  const { createMultiplayerSummaries } = await import("../../server/multiplayer-summary");
  createMultiplayerSummaries(db);
  const summaries = (await a.get("/summaries").expect(200)).body;
  expect(summaries.games[0].id).toBe(g.id);
});

it("opens a creator's own invitation as waiting without consuming it", async () => {
  const { a, b } = await fixture();
  const invite = (await a.post("/invites", { color: "w" }).expect(201)).body;
  const waiting = (await a.post("/join", { token: invite.token }).expect(200)).body;
  expect(waiting.status).toBe("waiting");
  expect(waiting.black).toBeNull();
  await b.post("/join", { token: invite.token }).expect(200);
});

// Captured by executing freshGame/reduceGame from the retained v1.2.0 tag.
import legacyActive from "../fixtures/multiplayer/v1.2-active.json";

it("continues a retained v1.2 game, preserves ownership and normalizes only on a successful write", async () => {
  const { db, a, b, c, game } = await fixture();
  const g = await game();
  const legacy = { ...legacyActive, id: g.id, revision: g.revision };
  const raw = JSON.stringify(legacy);
  db.prepare("UPDATE mp_games SET state_json=? WHERE id=?").run(raw, g.id);
  await c.get(`/${g.id}`).expect(404);
  await a.get(`/${g.id}`).expect(200);
  expect(db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(g.id)).toEqual({
    state_json: raw,
  });
  const moved = (
    await b
      .post(`/${g.id}/move`, { expectedRevision: g.revision, move: { from: 12, to: 28 } })
      .expect(200)
  ).body;
  expect(moved.moves.map((m: { san: string }) => m.san)).toEqual(["e4", "e5"]);
  expect(moved.white.id).toBe(a.id);
  expect(moved.black.id).toBe(b.id);
});

it.each(["json", "illegal", "unknown"])(
  "preserves unreadable %s multiplayer data with recovery diagnostics",
  async (kind) => {
    const { db, a, game } = await fixture();
    const g = await game();
    const legacy = { ...legacyActive, id: g.id, revision: g.revision };
    const raw =
      kind === "json"
        ? "{"
        : JSON.stringify(
            kind === "illegal"
              ? { ...legacy, hist: [{ ...legacy.hist[0], mv: { from: 0, to: 63 } }] }
              : { ...legacy, opponent: { id: "future", version: 999 } },
          );
    db.prepare("UPDATE mp_games SET state_json=? WHERE id=?").run(raw, g.id);
    const response = await a.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(409);
    expect(response.body.error).toMatch(/preserved.*recovery/i);
    expect(db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(g.id)).toEqual({
      state_json: raw,
    });
    expect(db.prepare("SELECT * FROM mp_ratings").all()).toEqual([]);
  },
);

it.each([
  [
    "second-rating",
    "CREATE TRIGGER fault BEFORE INSERT ON mp_ratings WHEN (SELECT count(*) FROM mp_ratings)=1 BEGIN SELECT RAISE(ABORT,'fault'); END",
  ],
  ["h2h", "CREATE TRIGGER fault BEFORE INSERT ON mp_pairs BEGIN SELECT RAISE(ABORT,'fault'); END"],
  [
    "game-save",
    "CREATE TRIGGER fault BEFORE UPDATE ON mp_games WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT,'fault'); END",
  ],
])("rolls back completion at %s and applies a retry exactly once", async (_name, sql) => {
  const { db, a, b, game } = await fixture();
  const g = await game();
  const before = db.prepare("SELECT * FROM mp_games WHERE id=?").get(g.id);
  const events = db.prepare("SELECT * FROM mp_events").all();
  db.exec(sql);
  await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(500);
  expect(db.prepare("SELECT * FROM mp_games WHERE id=?").get(g.id)).toEqual(before);
  expect(db.prepare("SELECT * FROM mp_events").all()).toEqual(events);
  expect(db.prepare("SELECT * FROM mp_ratings").all()).toEqual([]);
  expect(db.prepare("SELECT * FROM mp_pairs").all()).toEqual([]);
  db.exec("DROP TRIGGER fault");
  await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200);
  await b.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(409);
  expect((await a.get("")).body.rating).toEqual({ rating: 1216, games: 1 });
  expect((await a.get("")).body.opponents[0].wins).toBe(1);
});

it("rolls back a join after its first event and retries without consuming the invitation", async () => {
  const { db, a, b } = await fixture();
  const invite = (await a.post("/invites", { color: "w" }).expect(201)).body;
  const before = db.prepare("SELECT * FROM mp_games WHERE id=?").get(invite.id);
  db.exec(
    "CREATE TRIGGER fault BEFORE INSERT ON mp_events WHEN NEW.kind='reminder' BEGIN SELECT RAISE(ABORT,'fault'); END",
  );
  await b.post("/join", { token: invite.token }).expect(500);
  expect(db.prepare("SELECT * FROM mp_games WHERE id=?").get(invite.id)).toEqual(before);
  expect(db.prepare("SELECT * FROM mp_events").all()).toEqual([]);
  db.exec("DROP TRIGGER fault");
  await b.post("/join", { token: invite.token }).expect(200);
  await b.post("/join", { token: invite.token }).expect(200);
  expect(db.prepare("SELECT kind FROM mp_events ORDER BY kind").all()).toEqual([
    { kind: "reminder" },
    { kind: "started" },
  ]);
});

it("joins a retained v1.2 waiting game and preserves its completed result on read", async () => {
  const { db, a, b } = await fixture();
  const invite = (await a.post("/invites", { color: "w" }).expect(201)).body;
  const row = db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(invite.id) as {
    state_json: string;
  };
  const legacy = JSON.parse(row.state_json);
  delete legacy.opponent;
  delete legacy.unratedReason;
  delete legacy.takebackUsed;
  db.prepare("UPDATE mp_games SET state_json=? WHERE id=?").run(JSON.stringify(legacy), invite.id);
  const joined = (await b.post("/join", { token: invite.token }).expect(200)).body;
  const completed = (
    await b.post(`/${invite.id}/resign`, { expectedRevision: joined.revision }).expect(200)
  ).body;
  const saved = JSON.parse(
    (
      db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(invite.id) as {
        state_json: string;
      }
    ).state_json,
  );
  delete saved.opponent;
  delete saved.unratedReason;
  delete saved.takebackUsed;
  const raw = JSON.stringify(saved);
  db.prepare("UPDATE mp_games SET state_json=? WHERE id=?").run(raw, invite.id);
  const reread = (await b.get(`/${invite.id}`).expect(200)).body;
  expect(reread.result).toEqual(completed.result);
  expect(reread.ratingChanges).toEqual(completed.ratingChanges);
  expect(reread.review.opponent.id).toBe("classic");
  expect(db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(invite.id)).toEqual({
    state_json: raw,
  });
});

it("settles a real automatic threefold draw exactly once for both players and H2H", async () => {
  const { db, a, b, game } = await fixture();
  let current = await game();
  const moves = [
    ["g1", "f3"],
    ["g8", "f6"],
    ["f3", "g1"],
    ["f6", "g8"],
    ["g1", "f3"],
    ["g8", "f6"],
    ["f3", "g1"],
    ["f6", "g8"],
  ];
  let lastRevision = current.revision;
  for (const [i, [from, to]] of moves.entries()) {
    lastRevision = current.revision;
    current = (
      await (i % 2 ? b : a)
        .post(`/${current.id}/move`, {
          expectedRevision: current.revision,
          move: { from: sqIndex(from), to: sqIndex(to) },
        })
        .expect(200)
    ).body;
  }
  expect(current.result).toMatchObject({ result: "½-½", reason: "Threefold repetition" });
  expect(current.ratingChanges).toEqual({ white: 0, black: 0 });
  expect(current.headToHead).toMatchObject({ draws: 1 });
  const ratings = () =>
    db.prepare("SELECT user_id,rating,games FROM mp_ratings ORDER BY user_id").all();
  const before = ratings();
  expect(before).toEqual(
    [
      { user_id: a.id, rating: 1200, games: 1 },
      { user_id: b.id, rating: 1200, games: 1 },
    ].sort((x, y) => (x.user_id < y.user_id ? -1 : x.user_id > y.user_id ? 1 : 0)),
  );
  await b
    .post(`/${current.id}/move`, {
      expectedRevision: lastRevision,
      move: { from: sqIndex("f6"), to: sqIndex("g8") },
    })
    .expect(409);
  await a.post(`/${current.id}/resign`, { expectedRevision: current.revision }).expect(409);
  expect(ratings()).toEqual(before);
  expect((await a.get(`/${current.id}`).expect(200)).body.headToHead.draws).toBe(1);
  expect((await b.get(`/${current.id}`).expect(200)).body.headToHead.draws).toBe(1);
});

it("serves private compact summaries while retaining complete legacy and detail responses", async () => {
  const { a, b, c, game, db } = await fixture();
  const g = await game();
  await a.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200);
  const summary = (await a.get("/summaries").expect(200)).body;
  expect(summary.games).toHaveLength(1);
  expect(summary.games[0].result.result).toBe("0-1");
  for (const key of ["review", "moves", "position"])
    expect(summary.games[0]).not.toHaveProperty(key);
  expect(summary.opponents[0].losses).toBe(1);
  expect((await a.get("/rating").expect(200)).body).toEqual({ rating: 1184, games: 1 });
  expect((await b.get("/summaries")).body.games).toHaveLength(1);
  expect((await c.get("/summaries")).body.games).toEqual([]);
  expect((await a.get(`/${g.id}`)).body.review).not.toBeNull();
  expect((await a.get("/")).body.games[0].review).not.toBeNull();
  await c.get(`/${g.id}`).expect(404);
  db.prepare("UPDATE mp_games SET state_json=? WHERE id=?").run("not json", g.id);
  expect((await a.get("/summaries").expect(200)).body.games[0].result.result).toBe("0-1");
});

it("backfills large disposable data in bounded batches, quarantines corruption, and polls without raw reads", async () => {
  const { db, a, game } = await fixture();
  const g = await game();
  const original = db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(g.id) as {
    state_json: string;
  };
  db.transaction(() => {
    const insert =
      db.prepare(`INSERT INTO mp_games(id,creator_id,white_id,black_id,status,revision,state_json,token_hash,created_at,expires_at)
      SELECT ?,creator_id,white_id,black_id,status,revision,state_json,?,created_at+?,expires_at FROM mp_games WHERE id=?`);
    for (let i = 0; i < 1200; i++) insert.run(`synthetic-${i}`, `token-${i}`, i, g.id);
    insert.run("corrupt", "corrupt-token", 0, g.id);
    db.prepare("UPDATE mp_games SET state_json='invalid-private-data' WHERE id='corrupt'").run();
  })();
  const { createMultiplayerSummaries } = await import("../../server/multiplayer-summary");
  createMultiplayerSummaries(db);
  expect(db.prepare("SELECT count(*) AS n FROM mp_summaries").get()).toEqual({ n: 1201 });
  expect(db.prepare("SELECT * FROM mp_summary_quarantine").all()).toEqual([
    { game_id: "corrupt", reason: expect.not.stringContaining("invalid-private-data") },
  ]);
  expect(db.prepare("SELECT state_json FROM mp_games WHERE id=?").get(g.id)).toEqual(original);
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN SELECT s.summary_json FROM mp_summary_members m JOIN mp_summaries s ON s.game_id=m.game_id
    WHERE m.user_id=? ORDER BY m.priority,m.created_at DESC,m.game_id LIMIT 200`,
    )
    .all(a.id) as { detail: string }[];
  expect(plan.map((p) => p.detail).join(" ")).toContain("mp_summary_order");
  expect(plan.map((p) => p.detail).join(" ")).not.toContain("TEMP B-TREE");
  // Removing the source table makes any request-time raw state lookup fail loudly.
  db.pragma("foreign_keys = OFF");
  db.exec("ALTER TABLE mp_games RENAME TO private_raw_games");
  const response = await a.get("/summaries").expect(200);
  expect(response.body.games).toHaveLength(200);
  expect(JSON.stringify(response.body).length).toBeLessThan(200_000);
  expect(JSON.stringify(response.body)).not.toMatch(/state_json|review|"moves"|"position"/);
});

it("pages lifetime H2H counts without exposing unrelated pairs", async () => {
  const { db, a, c } = await fixture();
  const template = db.prepare("SELECT * FROM user WHERE id=?").get(a.id) as Record<string, unknown>;
  const keys = Object.keys(template);
  const insert = db.prepare(
    `INSERT INTO user(${keys.map((k) => `"${k}"`).join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
  );
  db.transaction(() => {
    for (let i = 0; i < 123; i++) {
      const id = `opponent-${String(i).padStart(3, "0")}`;
      insert.run(
        ...keys.map((k) =>
          k === "id" ? id : k === "email" ? `${id}@example.com` : k === "name" ? id : template[k],
        ),
      );
      const [low, high] = [a.id, id].sort();
      db.prepare("INSERT INTO mp_pairs VALUES(?,?,?,?,?)").run(low, high, 700, 300, 100);
    }
  })();
  const first = (await a.get("/summaries").expect(200)).body;
  const second = (await a.get(`/summaries?after=${first.nextOpponents}`).expect(200)).body;
  const third = (await a.get(`/summaries?after=${second.nextOpponents}`).expect(200)).body;
  expect([first.opponents.length, second.opponents.length, third.opponents.length]).toEqual([
    50, 50, 23,
  ]);
  expect(
    new Set([...first.opponents, ...second.opponents, ...third.opponents].map((p) => p.opponent.id))
      .size,
  ).toBe(123);
  expect(third.nextOpponents).toBeNull();
  expect(first.opponents[0].wins + first.opponents[0].losses + first.opponents[0].draws).toBe(1100);
  expect((await c.get("/summaries")).body.opponents).toEqual([]);
  await a.get("/summaries?after=one&after=two").expect(400);
});

it("rolls back game, rating and H2H when the summary projection write fails", async () => {
  const { db, a, game } = await fixture();
  const g = await game();
  db.exec(
    "CREATE TRIGGER fail_summary BEFORE INSERT ON mp_summaries BEGIN SELECT RAISE(ABORT,'synthetic projection failure'); END",
  );
  await a.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(500);
  expect((await a.get(`/${g.id}`)).body.status).toBe("active");
  expect((await a.get("/summaries")).body.games[0].status).toBe("active");
  expect(db.prepare("SELECT * FROM mp_ratings").all()).toEqual([]);
  expect(db.prepare("SELECT * FROM mp_pairs").all()).toEqual([]);
  db.exec("DROP TRIGGER fail_summary");
  await a.post(`/${g.id}/resign`, { expectedRevision: g.revision }).expect(200);
  const list = (await a.get("/summaries")).body;
  expect(list.games[0].status).toBe("completed");
  expect(list.rating.games).toBe(1);
  expect(list.opponents[0].losses).toBe(1);
});
