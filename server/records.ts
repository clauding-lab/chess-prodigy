import type Database from "better-sqlite3";
import { Router, type RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Session, LegacySession } from "../src/game/types.js";
import type { GameRecord, LegacyGameRecord } from "../src/account/types.js";
import { parseSavedState } from "../src/storage/schema.js";
import { archiveGame } from "../src/game/archive.js";
import { parseGameRecord } from "../src/account/records.js";
import type { ChessAuth } from "./auth.js";

import { isRatedOpponent } from "../src/engine/opponents.js";

const MAX_SNAPSHOT_BYTES = 256 * 1024;
const MAX_HISTORY = 500;
const MAX_ARCHIVED_GAMES = 200;

export interface RecordsEnvelope {
  version: number;
  snapshot: Session | LegacySession | null;
  games: (GameRecord | LegacyGameRecord)[];
  updatedAt: string | null;
}

export interface PutRecordsBody {
  expectedVersion: number;
  snapshot: Session | LegacySession;
}

export interface LeaderboardPlayer {
  rank: number;
  name: string;
  rating: number;
  games: number;
}

export interface LeaderboardEnvelope {
  players: LeaderboardPlayer[];
}

interface AuthenticatedRequest extends Express.Request {
  accountUserId?: string;
}

function initialize(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS player_records (
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      version INTEGER NOT NULL CHECK(version >= 0),
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_records (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      record TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );
    CREATE INDEX IF NOT EXISTS game_records_owner_completed
      ON game_records(user_id, completed_at DESC);
    CREATE TABLE IF NOT EXISTS record_client_policy (
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS record_rate_limits (
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      route TEXT NOT NULL,
      window_started INTEGER NOT NULL,
      request_count INTEGER NOT NULL,
      PRIMARY KEY (user_id, route)
    );
  `);
}

function consumeRateLimit(
  database: Database.Database,
  userId: string,
  route: string,
): { allowed: boolean; retryAfter: number } {
  const now = Math.floor(Date.now() / 1000);
  return database.transaction(() => {
    const row = database
      .prepare(
        "SELECT window_started, request_count FROM record_rate_limits WHERE user_id = ? AND route = ?",
      )
      .get(userId, route) as { window_started: number; request_count: number } | undefined;
    if (!row || now - row.window_started >= 60) {
      database
        .prepare(
          `
          INSERT INTO record_rate_limits(user_id, route, window_started, request_count) VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, route) DO UPDATE SET window_started = excluded.window_started, request_count = 1
        `,
        )
        .run(userId, route, now);
      return { allowed: true, retryAfter: 0 };
    }
    if (row.request_count >= 60) {
      return { allowed: false, retryAfter: Math.max(1, 60 - (now - row.window_started)) };
    }
    database
      .prepare(
        "UPDATE record_rate_limits SET request_count = request_count + 1 WHERE user_id = ? AND route = ?",
      )
      .run(userId, route);
    return { allowed: true, retryAfter: 0 };
  })();
}

function isBoundedSnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Record<string, unknown>;
  const game = session.game as Record<string, unknown> | undefined;
  if (!game || typeof game !== "object" || Array.isArray(game)) return false;
  if (
    typeof game.clockAt !== "number" ||
    !Number.isFinite(game.clockAt) ||
    Math.abs(game.clockAt) > 8_640_000_000_000_000
  )
    return false;
  if (!Array.isArray(game.hist) || game.hist.length > MAX_HISTORY) return false;
  if (
    !game.keys ||
    typeof game.keys !== "object" ||
    Array.isArray(game.keys) ||
    Object.keys(game.keys).length > MAX_HISTORY + 1
  )
    return false;
  if (
    !game.evals ||
    typeof game.evals !== "object" ||
    Array.isArray(game.evals) ||
    Object.keys(game.evals).length > MAX_HISTORY + 1
  )
    return false;
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return false;
  }
  return Buffer.byteLength(encoded, "utf8") <= MAX_SNAPSHOT_BYTES;
}

function readEnvelope(database: Database.Database, userId: string): RecordsEnvelope {
  const row = database
    .prepare("SELECT version, snapshot, updated_at FROM player_records WHERE user_id = ?")
    .get(userId) as { version: number; snapshot: string; updated_at: string } | undefined;
  const games = database
    .prepare(
      "SELECT record FROM game_records WHERE user_id = ? ORDER BY completed_at DESC, game_id DESC LIMIT ?",
    )
    .all(userId, MAX_ARCHIVED_GAMES) as Array<{ record: string }>;
  return {
    version: row?.version ?? 0,
    snapshot: row ? (JSON.parse(row.snapshot) as Session | LegacySession) : null,
    games: games.map(({ record }) => JSON.parse(record) as GameRecord | LegacyGameRecord),
    updatedAt: row?.updated_at ?? null,
  };
}

export function createRecordsRouter(database: Database.Database, auth: ChessAuth, baseURL: string) {
  initialize(database);
  const router = Router();
  const authenticate: RequestHandler = async (request, response, next) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session || request.get("x-chess-account") !== session.user.id) {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    (request as unknown as AuthenticatedRequest).accountUserId = session.user.id;
    next();
  };

  router.use(authenticate);
  router.use((request, response, next) => {
    const limit = consumeRateLimit(
      database,
      (request as unknown as AuthenticatedRequest).accountUserId!,
      `records:${request.method}`,
    );
    if (!limit.allowed) {
      response.set("Retry-After", String(limit.retryAfter));
      response.status(429).json({ error: "Too many record requests." });
      return;
    }
    next();
  });
  router.get("/", (request, response) => {
    response.json(
      readEnvelope(database, (request as unknown as AuthenticatedRequest).accountUserId!),
    );
  });
  router.put("/", (request, response) => {
    if (request.get("origin") !== new URL(baseURL).origin) {
      response.status(403).json({ error: "Origin is not allowed." });
      return;
    }
    const body = request.body as Partial<PutRecordsBody> | undefined;
    if (
      !body ||
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion! < 0 ||
      !isBoundedSnapshot(body.snapshot)
    ) {
      response.status(400).json({ error: "Invalid record snapshot." });
      return;
    }
    const snapshot = parseSavedState(body.snapshot, { preserveDerived: true });
    if (!snapshot) {
      response.status(400).json({ error: "Invalid record snapshot." });
      return;
    }
    const archive = archiveGame(snapshot);
    if (archive && !parseGameRecord(archive)) {
      response.status(400).json({ error: "Invalid game archive." });
      return;
    }
    const userId = (request as unknown as AuthenticatedRequest).accountUserId!;
    const transaction = database.transaction(() => {
      const current = database
        .prepare("SELECT version, snapshot FROM player_records WHERE user_id = ?")
        .get(userId) as { version: number; snapshot: string } | undefined;
      const version = current?.version ?? 0;
      if (version !== body.expectedVersion) return "conflict";
      // Compare schema and write in the same transaction. A stale client with the
      // latest record counter still cannot erase fields it cannot understand.
      if (
        current &&
        body.snapshot!.version === 1 &&
        (JSON.parse(current.snapshot) as { version: number }).version >= 2
      )
        return "upgrade";
      const measured =
        snapshot.game.opponent.id === "attack-development" &&
        isRatedOpponent(snapshot.game.opponent);
      const protectedAccount = database
        .prepare("SELECT user_id FROM record_client_policy WHERE user_id = ?")
        .get(userId);
      if ((measured || protectedAccount) && request.get("X-Chess-Rating-Policy") !== "1")
        return "upgrade";
      if (measured)
        database
          .prepare("INSERT OR IGNORE INTO record_client_policy(user_id) VALUES (?)")
          .run(userId);
      const updatedAt = new Date().toISOString();
      database
        .prepare(
          `
        INSERT INTO player_records(user_id, version, snapshot, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, snapshot = excluded.snapshot, updated_at = excluded.updated_at
      `,
        )
        // Preserve the validated original wire for old clients' exact acknowledgement.
        .run(userId, version + 1, JSON.stringify(body.snapshot), updatedAt);
      if (archive) {
        database
          .prepare(
            `
          INSERT INTO game_records(user_id, game_id, record, completed_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, game_id) DO UPDATE SET record = excluded.record, completed_at = excluded.completed_at
        `,
          )
          .run(userId, archive.id, JSON.stringify(archive), archive.completedAt);
      } else {
        database
          .prepare("DELETE FROM game_records WHERE user_id = ? AND game_id = ?")
          .run(userId, snapshot.game.id);
      }
      database
        .prepare(
          `
        DELETE FROM game_records WHERE user_id = ? AND game_id NOT IN (
          SELECT game_id FROM game_records WHERE user_id = ? ORDER BY completed_at DESC, game_id DESC LIMIT ?
        )
      `,
        )
        .run(userId, userId, MAX_ARCHIVED_GAMES);
      return "ok";
    });
    const outcome = transaction();
    if (outcome === "upgrade") {
      response.status(426).json({
        error:
          "This account uses newer saves. Update Chess Prodigy before syncing; the server copy is unchanged.",
      });
      return;
    }
    if (outcome === "conflict") {
      response
        .status(409)
        .json({ error: "Record version conflict.", current: readEnvelope(database, userId) });
      return;
    }
    response.json(readEnvelope(database, userId));
  });
  return router;
}

export function readLeaderboard(database: Database.Database): LeaderboardEnvelope {
  const rows = database
    .prepare(
      `
    SELECT u.name AS name,
           json_extract(r.snapshot, '$.rating.rating') AS rating,
           json_extract(r.snapshot, '$.rating.games') AS games
      FROM player_records r
      JOIN user u ON u.id = r.user_id
     WHERE json_extract(r.snapshot, '$.rating.games') >= 1
     ORDER BY rating DESC, games DESC, r.user_id ASC
     LIMIT 100
  `,
    )
    .all() as Array<{ name: string; rating: number; games: number }>;
  return { players: rows.map((player, index) => ({ rank: index + 1, ...player })) };
}
