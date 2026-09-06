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
afterEach(() => {
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
  router.use("/mp", createMultiplayerRouter(db, auth, origin));
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
});

it("opens a creator's own invitation as waiting without consuming it", async () => {
  const { a, b } = await fixture();
  const invite = (await a.post("/invites", { color: "w" }).expect(201)).body;
  const waiting = (await a.post("/join", { token: invite.token }).expect(200)).body;
  expect(waiting.status).toBe("waiting");
  expect(waiting.black).toBeNull();
  await b.post("/join", { token: invite.token }).expect(200);
});
