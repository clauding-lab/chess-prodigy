// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import Database from "better-sqlite3";
import request, { type SuperAgentTest } from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { freshSession, reduceSession } from "../../src/game/state";
import { legalMoves, sqIndex } from "../../src/engine/board";
import {
  morphyConfig,
  historicalMorphyConfig,
  plannedMorphyConfig,
} from "../../src/engine/opponents";
import { createTestApplication as createApplication } from "./http-fixture";

const BASE_URL = "http://127.0.0.1:4317";
const SECRET = "test-secret-with-at-least-thirty-two-characters";
const tempDirectories: string[] = [];

async function temporaryDatabase(): Promise<{ directory: string; path: string }> {
  const directory = await mkdtemp(join(tmpdir(), "chess-prodigy-server-"));
  tempDirectories.push(directory);
  return { directory, path: join(directory, "accounts.sqlite") };
}

async function signedUpAgent(
  app: Parameters<typeof request.agent>[0],
  email: string,
  name = "Player One",
): Promise<SuperAgentTest> {
  const agent = request.agent(app);
  const result = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", BASE_URL)
    .send({ name, email, password: "correct horse battery staple" })
    .expect(200);
  agent.set("X-Chess-Account", result.body.user.id);
  return agent;
}

function completedSession(
  id: string,
  now = 1_800_000_000_000,
  level: "casual" | "club" | "strong" = "club",
) {
  let session = freshSession(now, id);
  session.game.setup.level = level;
  session = reduceSession(session, {
    type: "move",
    move: legalMoves(session.game.st)[0],
    book: false,
    now: now + 1,
  });
  return reduceSession(session, { type: "resign", now: now + 2 });
}

function winningSession(id: string, now = 1_800_000_000_000) {
  let session = freshSession(now, id);
  session.game.setup.playerColor = "b";
  session.game.setup.level = "strong";
  for (const [offset, from, to] of [
    [1, "f2", "f3"],
    [2, "e7", "e5"],
    [3, "g2", "g4"],
    [4, "d8", "h4"],
  ] as const) {
    const move = legalMoves(session.game.st).find(
      (candidate) => candidate.from === sqIndex(from) && candidate.to === sqIndex(to),
    );
    if (!move) throw new Error(`Missing fixture move ${from}-${to}`);
    session = reduceSession(session, { type: "move", move, book: false, now: now + offset });
  }
  return session;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("private account records", () => {
  it("acknowledges legacy wire snapshots exactly but rejects a downgrade even at the current write version", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    try {
      const agent = await signedUpAgent(application.app, "schema@example.com");
      const modern = freshSession(0, "modern"),
        old = JSON.parse(JSON.stringify(modern));
      old.version = 1;
      delete old.game.opponent;
      delete old.game.unratedReason;
      delete old.game.takebackUsed;
      const legacy = await agent
        .put("/api/records")
        .set("Origin", BASE_URL)
        .send({ expectedVersion: 0, snapshot: old })
        .expect(200);
      expect(legacy.body.snapshot).toEqual(old);
      await agent
        .put("/api/records")
        .set("Origin", BASE_URL)
        .send({ expectedVersion: 1, snapshot: modern })
        .expect(200);
      await agent
        .put("/api/records")
        .set("Origin", BASE_URL)
        .send({ expectedVersion: 2, snapshot: old })
        .expect(426);
      const kept = await agent.get("/api/records").expect(200);
      expect(kept.body).toMatchObject({ version: 2, snapshot: modern });
    } finally {
      await application.close();
    }
  });

  it("archives beta identity idempotently across terminal, undo and recompletion without rating it", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    try {
      const agent = await signedUpAgent(application.app, "beta@example.com");
      let s = reduceSession(freshSession(0, "initial"), {
        type: "new",
        id: "beta",
        now: 0,
        setup: { playerColor: "w", level: "strong", time: "none", opponent: morphyConfig(777) },
      });
      s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 1 });
      s = reduceSession(s, { type: "resign", now: 2 });
      let version = 0;
      const put = () =>
        agent
          .put("/api/records")
          .set("Origin", BASE_URL)
          .send({ expectedVersion: version++, snapshot: s })
          .expect(200);
      const first = await put();
      await put();
      expect(first.body.games).toHaveLength(1);
      expect(first.body.games[0]).toMatchObject({
        recordVersion: 2,
        opponent: morphyConfig(777),
        unratedReason: "beta",
        assisted: false,
        rated: false,
      });
      expect(first.body.snapshot.rating.games).toBe(0);
      s = reduceSession(s, { type: "undo", now: 3 });
      expect((await put()).body.games).toEqual([]);
      s = reduceSession(s, { type: "move", move: legalMoves(s.game.st)[0], book: false, now: 4 });
      s = reduceSession(s, { type: "resign", now: 5 });
      const recompleted = await put();
      expect(recompleted.body.games).toHaveLength(1);
      expect(recompleted.body.games[0]).toMatchObject({
        opponent: morphyConfig(777),
        assisted: true,
        rated: false,
        unratedReason: "beta",
      });
      const leaderboard = await request(application.app).get("/api/leaderboard").expect(200);
      expect(leaderboard.body.players).toEqual([]);
    } finally {
      await application.close();
    }
  });
  it("rejects stale-tab owner identities without reading or overwriting the current account", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    try {
      const first = await signedUpAgent(application.app, "tab-a@example.com");
      const a = await first.get("/api/auth/get-session");
      const second = await signedUpAgent(application.app, "tab-b@example.com");
      await second.get("/api/records").set("X-Chess-Account", a.body.user.id).expect(401);
      await second
        .put("/api/records")
        .set("Origin", BASE_URL)
        .set("X-Chess-Account", a.body.user.id)
        .send({ expectedVersion: 0, snapshot: completedSession("a-private-game") })
        .expect(401);
      await second
        .post("/api/auth/change-password")
        .set("Origin", BASE_URL)
        .set("X-Chess-Account", a.body.user.id)
        .send({
          currentPassword: "correct horse battery staple",
          newPassword: "another safe password here",
        })
        .expect(401);
      const own = await second.get("/api/records").expect(200);
      expect(own.body.snapshot).toBeNull();
      expect(own.body.version).toBe(0);
    } finally {
      await application.close();
    }
  });
  it("redirects public HTTP traffic to the configured HTTPS origin", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: "https://chess.example.com",
      secret: SECRET,
    });
    try {
      await request(application.app)
        .get("/play?from=home")
        .set("X-Forwarded-Proto", "http")
        .set("Host", "attacker.example")
        .expect(308)
        .expect("Location", "https://chess.example.com/play?from=home");
      await request(application.app)
        .get("/api/health")
        .set("X-Forwarded-Proto", "https")
        .expect(200)
        .expect("Strict-Transport-Security", "max-age=31536000");
    } finally {
      await application.close();
    }
  });
  it("requires a real session for private reads", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    await request(application.app)
      .get("/api/records")
      .expect(401)
      .expect("Cache-Control", /no-store/);
    await application.close();
  });

  it("registers, signs out, signs in, and stores only a password hash", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = await signedUpAgent(application.app, "player@example.com", "  Player One  ");

    const session = await agent.get("/api/auth/get-session").expect(200);
    expect(session.body.user.name).toBe("Player One");
    await agent
      .post("/api/auth/update-user")
      .set("Origin", BASE_URL)
      .send({ name: "x".repeat(81) })
      .expect(400);
    await agent.post("/api/auth/sign-out").set("Origin", BASE_URL).expect(200);
    await agent.get("/api/records").expect(401);
    await agent
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "player@example.com", password: "wrong password here" })
      .expect(401);
    await agent
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "player@example.com", password: "correct horse battery staple" })
      .expect(200);

    const sqlite = new Database(database.path, { readonly: true });
    const rows = sqlite
      .prepare("select password from account where password is not null")
      .all() as Array<{ password: string }>;
    sqlite.close();
    expect(rows).toHaveLength(1);
    expect(rows[0].password).not.toContain("correct horse battery staple");
    await application.close();
  });

  it("enforces account field bounds and production secure cookies", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: "https://chess.example.com",
      secret: SECRET,
    });
    await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "https://chess.example.com")
      .send({ name: "x".repeat(81), email: "long@example.com", password: "a".repeat(12) })
      .expect(400);
    await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "https://chess.example.com")
      .send({ name: "Valid", email: "short@example.com", password: "a".repeat(11) })
      .expect(400);
    await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "https://chess.example.com")
      .send({ name: "Valid", email: "long-password@example.com", password: "a".repeat(129) })
      .expect(400);
    const response = await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", "https://chess.example.com")
      .send({ name: "Valid", email: "valid@example.com", password: "a".repeat(12) })
      .expect(200);
    expect(response.headers["set-cookie"].join(";")).toMatch(/Secure/i);
    expect(response.headers["set-cookie"].join(";")).toMatch(/SameSite=Lax/i);
    await application.close();
  });

  it("accepts bounded compressed authentication bodies after decoding", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const server = application.app;
    try {
      const body = gzipSync(
        JSON.stringify({
          name: "Compressed User",
          email: "compressed@example.com",
          password: "correct horse battery staple",
          padding: "x".repeat(1000),
        }),
      );
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/sign-up/email`,
        {
          method: "POST",
          headers: {
            Origin: BASE_URL,
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
          },
          body,
        },
      );
      expect(response.status).toBe(200);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await application.close();
    }
  });

  it("rejects oversized authentication bodies before Better Auth processes them", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    await request(application.app)
      .post("/api/auth/sign-up/email")
      .set("Origin", BASE_URL)
      .send({
        name: "Padded User",
        email: "padded@example.com",
        password: "correct horse battery staple",
        padding: "x".repeat(20_000),
      })
      .expect(413);
    await request(application.app).get("/api/leaderboard").expect(200, { players: [] });
    await application.close();
  });

  it("rejects cross-origin writes, malformed snapshots, and stale versions", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = await signedUpAgent(application.app, "writer@example.com");
    const snapshot = freshSession(100, "game-one");
    await agent
      .put("/api/records")
      .set("Origin", "https://evil.example")
      .send({ expectedVersion: 0, snapshot })
      .expect(403);
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: { version: 1 } })
      .expect(400);
    const accepted = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot })
      .expect(200);
    expect(accepted.body).toMatchObject({ version: 1, snapshot, games: [] });
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot })
      .expect(409);
    await application.close();
  });

  it("archives completed games idempotently and removes only the undone current game", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = await signedUpAgent(application.app, "archive@example.com");
    const completed = completedSession("archive-game");
    const first = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: completed })
      .expect(200);
    expect(first.body.games).toEqual([
      expect.objectContaining({
        id: "archive-game",
        result: "0-1",
        reason: "Resignation",
        level: "club",
        playerColor: "w",
        rated: true,
        moves: ["a3"],
      }),
    ]);
    const repeated = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 1, snapshot: completed })
      .expect(200);
    expect(repeated.body.games).toHaveLength(1);
    const undone = reduceSession(completed, { type: "undo", now: 1_800_000_000_003 });
    const afterUndo = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 2, snapshot: undone })
      .expect(200);
    expect(afterUndo.body.games).toEqual([]);
    await application.close();
  });

  it("isolates owners and restores records after reopening the database", async () => {
    const database = await temporaryDatabase();
    let application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const first = await signedUpAgent(application.app, "first@example.com");
    const second = await signedUpAgent(application.app, "second@example.com");
    const snapshot = completedSession("private-game");
    await first
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot })
      .expect(200);
    const other = await second.get("/api/records").expect(200);
    expect(other.body).toEqual({ version: 0, snapshot: null, games: [], updatedAt: null });
    await application.close();

    application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const restored = request.agent(application.app);
    const restoredLogin = await restored
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "first@example.com", password: "correct horse battery staple" })
      .expect(200);
    restored.set("X-Chess-Account", restoredLogin.body.user.id);
    const records = await restored.get("/api/records").expect(200);
    expect(records.body.version).toBe(1);
    expect(records.body.snapshot.game.id).toBe("private-game");
    expect(records.body.games).toHaveLength(1);
    await application.close();
  });

  it("rejects structurally excessive snapshots before replay", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = await signedUpAgent(application.app, "bounds@example.com");
    const snapshot = freshSession(100, "bounded");
    snapshot.game.hist = Array.from({ length: 501 }, () => ({}) as never);
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot })
      .expect(400);
    const multibyteSnapshot = freshSession(100, "😀".repeat(70_000));
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: multibyteSnapshot })
      .expect(400);
    const invalidTimestamp = freshSession(100, "invalid-timestamp");
    invalidTimestamp.game.clockAt = Number.MAX_VALUE;
    invalidTimestamp.game.over = { result: "1-0", reason: "Finished" };
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: invalidTimestamp })
      .expect(400);
    await application.close();
  });

  it("publishes only eligible display names and practice ratings in ranked order", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const lower = await signedUpAgent(application.app, "lower@example.com", "Lower Player");
    const higher = await signedUpAgent(application.app, "higher@example.com", "Higher Player");
    await signedUpAgent(application.app, "new@example.com", "No Games Yet");
    await lower
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: completedSession("low", 1_800_000_000_000, "casual") })
      .expect(200);
    await higher
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: winningSession("high", 1_800_000_001_000) })
      .expect(200);

    const response = await request(application.app)
      .get("/api/leaderboard")
      .expect(200)
      .expect("Cache-Control", /no-store/);
    expect(response.body.players.map((player: { name: string }) => player.name)).toEqual([
      "Higher Player",
      "Lower Player",
    ]);
    expect(response.body.players.map((player: { rank: number }) => player.rank)).toEqual([1, 2]);
    expect(
      response.body.players.every(
        (player: Record<string, unknown>) =>
          Object.keys(player).sort().join(",") === "games,name,rank,rating",
      ),
    ).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("@example.com");
    await application.close();
  });

  it("persists a bounded records request rate", async () => {
    const database = await temporaryDatabase();
    const application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = await signedUpAgent(application.app, "limited@example.com");
    for (let count = 0; count < 60; count++) await agent.get("/api/records").expect(200);
    await agent.get("/api/records").expect(429).expect("Retry-After", /\d+/);
    await application.close();
  });
});

it("acknowledges exact legacy wire saves while modern consumers invalidate derived review", async () => {
  const { parseRecordsEnvelope } = await import("../../src/account/records");
  const database = await temporaryDatabase();
  const application = await createApplication({
    databasePath: database.path,
    baseURL: BASE_URL,
    secret: SECRET,
  });
  try {
    const agent = await signedUpAgent(application.app, "review-migration@example.com");
    const snapshot = completedSession("legacy-review");
    snapshot.game.evals[0] = { score: 8888, best: legalMoves(snapshot.game.hist[0].before)[0] };
    snapshot.game.hist[0].ann = "!";
    const accepted = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot })
      .expect(200);
    expect(JSON.stringify(accepted.body.snapshot)).toBe(JSON.stringify(snapshot));
    const read = await agent.get("/api/records").expect(200);
    const current = parseRecordsEnvelope(read.body)!;
    expect(current.version).toBe(1);
    expect(current.snapshot!.game.evals).toEqual({});
    expect(current.snapshot!.game.hist[0].ann).toBeNull();
    expect(current.snapshot!.rating).toEqual(snapshot.rating);
    expect(current.snapshot!.game.ratingApplied).toEqual(snapshot.game.ratingApplied);
    expect(current.games[0].moves).toEqual(snapshot.game.hist.map((e) => e.san));
  } finally {
    await application.close();
  }
});

it("permanently fences old clients after measured Morphy, including after Classic and rating reset", async () => {
  const database = await temporaryDatabase();
  let application = await createApplication({
    databasePath: database.path,
    baseURL: BASE_URL,
    secret: SECRET,
  });
  try {
    const agent = await signedUpAgent(application.app, "measured@example.com");
    let s = reduceSession(freshSession(0, "first"), {
      type: "new",
      id: "measured",
      now: 0,
      setup: {
        playerColor: "w",
        level: "club",
        time: "none",
        opponent: { ...morphyConfig(2), version: 2 },
      },
    });
    s = reduceSession(s, { type: "hint" });
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: s })
      .expect(426);
    const accepted = await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Rating-Policy", "1")
      .send({ expectedVersion: 0, snapshot: s })
      .expect(200);
    expect(accepted.body.snapshot).toEqual(s);
    s = reduceSession(s, {
      type: "new",
      id: "classic",
      now: 1,
      setup: { playerColor: "w", level: "club", time: "none" },
    });
    s = reduceSession(s, { type: "resetRating" });
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Rating-Policy", "1")
      .send({ expectedVersion: 1, snapshot: s })
      .expect(200);
    await agent
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 2, snapshot: freshSession(2, "old-device") })
      .expect(426);
    const kept = await agent.get("/api/records").expect(200);
    expect(kept.body).toMatchObject({ version: 2, snapshot: s });
    await application.close();
    application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const reopened = request.agent(application.app);
    const login = await reopened
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "measured@example.com", password: "correct horse battery staple" })
      .expect(200);
    await reopened
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Account", login.body.user.id)
      .send({ expectedVersion: 2, snapshot: freshSession(2, "old-after-restart") })
      .expect(426);
  } finally {
    await application.close();
  }
});

it("migrates legacy policy rows additively and raises policy atomically for assisted historical games", async () => {
  const database = await temporaryDatabase();
  let application = await createApplication({
    databasePath: database.path,
    baseURL: BASE_URL,
    secret: SECRET,
  });
  try {
    await signedUpAgent(application.app, "policy-migration@example.com");
    await application.close();
    const db = new Database(database.path);
    const { id } = db
      .prepare("SELECT id FROM user WHERE email = ?")
      .get("policy-migration@example.com") as { id: string };
    // Recreate the actual pre-upgrade table shape in this disposable database.
    db.exec(
      "DROP TABLE record_client_policy; CREATE TABLE record_client_policy (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE)",
    );
    db.prepare("INSERT INTO record_client_policy(user_id) VALUES (?)").run(id);
    db.close();
    application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const agent = request.agent(application.app);
    await agent
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "policy-migration@example.com", password: "correct horse battery staple" })
      .expect(200);
    agent.set("X-Chess-Account", id);
    const put = (
      expectedVersion: number,
      snapshot: ReturnType<typeof freshSession>,
      policy?: string,
    ) => {
      const r = agent.put("/api/records").set("Origin", BASE_URL);
      if (policy !== undefined) r.set("X-Chess-Rating-Policy", policy);
      return r.send({ expectedVersion, snapshot });
    };
    await put(0, freshSession(0, "legacy"), "1").expect(200);
    await put(1, freshSession(0, "modern"), "2").expect(200);
    let historical = reduceSession(freshSession(0, "initial"), {
      type: "new",
      id: "historical",
      now: 0,
      setup: {
        playerColor: "w",
        level: "strong",
        time: "none",
        opponent: historicalMorphyConfig(2),
      },
    });
    historical = reduceSession(historical, { type: "hint" });
    historical = reduceSession(historical, {
      type: "move",
      move: legalMoves(historical.game.st)[0],
      book: false,
      now: 1,
    });
    historical = reduceSession(historical, { type: "resign", now: 2 });
    for (const policy of [undefined, "1", "4", "02"]) await put(2, historical, policy).expect(426);
    await put(1, historical, "2").expect(409);
    // A conflicting or rejected attempt must not raise protection or archive anything.
    await put(2, freshSession(0, "still-legacy-policy"), "1").expect(200);
    expect((await agent.get("/api/records")).body.games).toEqual([]);
    const accepted = await put(3, historical, "2").expect(200);
    expect(accepted.body.snapshot).toEqual(historical);
    expect(accepted.body.games).toMatchObject([
      { rated: false, assisted: true, opponent: { version: 3 } },
    ]);
    const reset = reduceSession(
      reduceSession(historical, {
        type: "new",
        id: "classic-reset",
        now: 3,
        setup: { playerColor: "w", level: "club", time: "none" },
      }),
      { type: "resetRating" },
    );
    await put(4, reset, "2").expect(200);
    for (const policy of [undefined, "1", "4"])
      await put(5, freshSession(4, "old-device"), policy).expect(426);
    expect((await agent.get("/api/records")).body).toMatchObject({ version: 5, snapshot: reset });
    const inspect = new Database(database.path);
    expect(
      inspect.prepare("SELECT minimum_policy FROM record_client_policy WHERE user_id = ?").get(id),
    ).toEqual({ minimum_policy: 2 });
    inspect.close();
    await application.close();
    application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const reopened = request.agent(application.app);
    await reopened
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "policy-migration@example.com", password: "correct horse battery staple" })
      .expect(200);
    await reopened
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Account", id)
      .set("X-Chess-Rating-Policy", "1")
      .send({ expectedVersion: 5, snapshot: reset })
      .expect(426);
    const other = await signedUpAgent(application.app, "fresh-policy@example.com");
    await other
      .put("/api/records")
      .set("Origin", BASE_URL)
      .send({ expectedVersion: 0, snapshot: historical })
      .expect(426);
    await other
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Rating-Policy", "2")
      .send({ expectedVersion: 0, snapshot: historical })
      .expect(200);
    await other
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Rating-Policy", "1")
      .send({ expectedVersion: 1, snapshot: reset })
      .expect(426);
  } finally {
    await application.close();
  }
});

it("permanently requires policy 3 after accepting an assisted planned Morphy save", async () => {
  const database = await temporaryDatabase();
  let application = await createApplication({
    databasePath: database.path,
    baseURL: BASE_URL,
    secret: SECRET,
  });
  try {
    const agent = await signedUpAgent(application.app, "planned-policy@example.com");
    let planned = reduceSession(freshSession(0, "initial"), {
      type: "new",
      id: "planned",
      now: 0,
      setup: {
        playerColor: "w",
        level: "strong",
        time: "none",
        opponent: plannedMorphyConfig(17),
      },
    });
    planned = reduceSession(planned, { type: "hint" });
    const put = (expectedVersion: number, snapshot: typeof planned, policy?: string) => {
      const call = agent.put("/api/records").set("Origin", BASE_URL);
      if (policy !== undefined) call.set("X-Chess-Rating-Policy", policy);
      return call.send({ expectedVersion, snapshot });
    };
    for (const policy of [undefined, "1", "2", "4", "02"])
      await put(0, planned, policy).expect(426);
    await put(1, planned, "3").expect(409);
    await put(0, freshSession(1, "pre-floor"), "2").expect(200);
    const accepted = await put(1, planned, "3").expect(200);
    expect(JSON.stringify(accepted.body.snapshot)).toBe(JSON.stringify(planned));
    expect(accepted.body.games).toEqual([]);
    const reset = reduceSession(
      reduceSession(planned, {
        type: "new",
        id: "classic-reset",
        now: 2,
        setup: { playerColor: "w", level: "club", time: "none" },
      }),
      { type: "resetRating" },
    );
    await put(2, reset, "3").expect(200);
    for (const policy of [undefined, "1", "2", "4", "02"])
      await put(3, freshSession(3, "older-client"), policy).expect(426);
    expect((await agent.get("/api/records")).body).toMatchObject({ version: 3, snapshot: reset });
    const inspect = new Database(database.path);
    const policyRows = inspect
      .prepare("SELECT minimum_policy FROM record_client_policy")
      .all() as Array<{ minimum_policy: number }>;
    expect(policyRows).toEqual([{ minimum_policy: 3 }]);
    inspect.close();
    await application.close();
    application = await createApplication({
      databasePath: database.path,
      baseURL: BASE_URL,
      secret: SECRET,
    });
    const reopened = request.agent(application.app);
    const login = await reopened
      .post("/api/auth/sign-in/email")
      .set("Origin", BASE_URL)
      .send({ email: "planned-policy@example.com", password: "correct horse battery staple" })
      .expect(200);
    await reopened
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Account", login.body.user.id)
      .set("X-Chess-Rating-Policy", "2")
      .send({ expectedVersion: 3, snapshot: reset })
      .expect(426);
    await reopened
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Account", login.body.user.id)
      .set("X-Chess-Rating-Policy", "3")
      .send({ expectedVersion: 3, snapshot: reset })
      .expect(200);
    const other = await signedUpAgent(application.app, "planned-policy-other@example.com");
    await other
      .put("/api/records")
      .set("Origin", BASE_URL)
      .set("X-Chess-Rating-Policy", "2")
      .send({ expectedVersion: 0, snapshot: freshSession(4, "independent-owner") })
      .expect(200);
  } finally {
    await application.close();
  }
});
