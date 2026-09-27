import type Database from "better-sqlite3";
import type { Rating } from "../src/rating/fide.js";
import { parseSessionInput } from "../src/storage/input.js";
import { MAX_COMPACT_BYTES } from "../src/storage/capacity.js";

export interface PublicLeaderboard {
  players: { rank: number; name: string; rating: number; games: number }[];
}
const CACHE_MS = 2000;
const cache = new WeakMap<Database.Database, { until: number; value: PublicLeaderboard }>();

export function writeRatingProjection(
  db: Database.Database,
  userId: string,
  version: number,
  rating: Rating,
): void {
  db.prepare(
    `INSERT INTO player_rating_projection(user_id,source_version,rating,games) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET source_version=excluded.source_version,rating=excluded.rating,games=excluded.games`,
  ).run(userId, version, rating.rating, rating.games);
  db.prepare("DELETE FROM record_projection_errors WHERE user_id=?").run(userId);
  cache.delete(db);
}

/** Startup backfill only. Public requests never parse private game snapshots. */
export function initializeLeaderboardProjection(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS player_rating_projection(
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    source_version INTEGER NOT NULL,rating REAL NOT NULL,games INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS player_rating_rank ON player_rating_projection(rating DESC,games DESC,user_id ASC) WHERE games>=1;
    CREATE TABLE IF NOT EXISTS record_projection_errors(
      user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
      source_version INTEGER NOT NULL,reason TEXT NOT NULL);`);
  return db.transaction(() => {
    let projected = 0,
      quarantined = 0;
    let after = "";
    for (;;) {
      const rows = db
        .prepare(
          `SELECT r.user_id,r.version,r.snapshot FROM player_records r
      LEFT JOIN player_rating_projection p ON p.user_id=r.user_id
      LEFT JOIN record_projection_errors e ON e.user_id=r.user_id
      WHERE r.user_id > ? AND (p.source_version IS NULL OR p.source_version!=r.version)
        AND (e.source_version IS NULL OR e.source_version!=r.version) ORDER BY r.user_id LIMIT 16`,
        )
        .all(after) as { user_id: string; version: number; snapshot: string }[];
      if (!rows.length) break;
      after = rows[rows.length - 1].user_id;
      for (const row of rows) {
        let snapshot = null;
        try {
          if (Buffer.byteLength(row.snapshot, "utf8") <= MAX_COMPACT_BYTES)
            snapshot = parseSessionInput(JSON.parse(row.snapshot));
        } catch {
          /* Quarantine by identity/version, never log private bytes. */
        }
        if (snapshot) {
          writeRatingProjection(db, row.user_id, row.version, snapshot.rating);
          projected++;
        } else {
          db.prepare("DELETE FROM player_rating_projection WHERE user_id=?").run(row.user_id);
          db.prepare(
            `INSERT INTO record_projection_errors(user_id,source_version,reason) VALUES(?,?,'invalid-snapshot')
          ON CONFLICT(user_id) DO UPDATE SET source_version=excluded.source_version,reason=excluded.reason`,
          ).run(row.user_id, row.version);
          quarantined++;
        }
      }
    }
    cache.delete(db);
    return { projected, quarantined };
  })();
}

export function readProjectedLeaderboard(
  db: Database.Database,
  now = Date.now(),
): PublicLeaderboard {
  const previous = cache.get(db);
  if (previous && now < previous.until) return previous.value;
  const rows = db
    .prepare(
      `SELECT u.name,p.rating,p.games FROM player_rating_projection p
    JOIN user u ON u.id=p.user_id WHERE p.games>=1
    ORDER BY p.rating DESC,p.games DESC,p.user_id ASC LIMIT 100`,
    )
    .all() as { name: string; rating: number; games: number }[];
  const value = { players: rows.map((row, index) => ({ rank: index + 1, ...row })) };
  cache.set(db, { until: now + CACHE_MS, value });
  return value;
}
