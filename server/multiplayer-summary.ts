import type Database from "better-sqlite3";
import { MultiplayerStateError, readMultiplayerState } from "./multiplayer-state.js";
import type { MultiplayerGame } from "../src/multiplayer/types.js";

export interface SummarySource {
  id: string;
  creator_id: string;
  white_id: string | null;
  black_id: string | null;
  status: MultiplayerGame["status"];
  revision: number;
  state_json: string;
  created_at: number;
  expires_at: number;
}
export interface StoredSummary {
  id: string;
  creatorId: string;
  whiteId: string | null;
  blackId: string | null;
  status: MultiplayerGame["status"];
  revision: number;
  turn: "w" | "b";
  result: MultiplayerGame["result"];
  createdAt: number;
  expiresAt: number;
}

/** A disposable, indexed projection; authoritative state is never rewritten by backfill. */
export function createMultiplayerSummaries(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS mp_summaries (
    game_id TEXT PRIMARY KEY REFERENCES mp_games(id), summary_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mp_summary_members (
      user_id TEXT NOT NULL, game_id TEXT NOT NULL REFERENCES mp_games(id),
      priority INTEGER NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,game_id));
    CREATE INDEX IF NOT EXISTS mp_summary_game ON mp_summary_members(game_id);
    CREATE INDEX IF NOT EXISTS mp_summary_order ON mp_summary_members(user_id,priority,created_at DESC,game_id);
    CREATE TABLE IF NOT EXISTS mp_summary_quarantine (
      game_id TEXT PRIMARY KEY REFERENCES mp_games(id), reason TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS mp_pairs_high ON mp_pairs(high_id,low_id);`);
  const put = db.prepare("INSERT OR REPLACE INTO mp_summaries VALUES(?,?)");
  const member = db.prepare("INSERT OR REPLACE INTO mp_summary_members VALUES(?,?,?,?)");
  function update(row: SummarySource) {
    if (
      !["waiting", "active", "completed", "cancelled", "expired"].includes(row.status) ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 0 ||
      !Number.isSafeInteger(row.created_at) ||
      !Number.isSafeInteger(row.expires_at) ||
      [row.id, row.creator_id].some((id) => typeof id !== "string" || !id || id.length > 128) ||
      [row.white_id, row.black_id].some(
        (id) => id !== null && (typeof id !== "string" || !id || id.length > 128),
      )
    )
      throw new MultiplayerStateError();
    const game = readMultiplayerState(row.state_json);
    const summary: StoredSummary = {
      id: row.id,
      creatorId: row.creator_id,
      whiteId: row.white_id,
      blackId: row.black_id,
      status: row.status,
      revision: row.revision,
      turn: game.st.turn,
      result: game.over,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
    put.run(row.id, JSON.stringify(summary));
    db.prepare("DELETE FROM mp_summary_members WHERE game_id=?").run(row.id);
    for (const user of new Set([row.creator_id, row.white_id, row.black_id])) {
      if (user)
        member.run(
          user,
          row.id,
          row.status === "active" ? 0 : row.status === "waiting" ? 1 : 2,
          row.created_at,
        );
    }
    db.prepare("DELETE FROM mp_summary_quarantine WHERE game_id=?").run(row.id);
  }
  // Keyset batches bound memory and transaction size even for very large legacy databases.
  let after = 0;
  while (true) {
    const rows = db
      .prepare(
        `SELECT g.rowid AS sequence,g.id,g.creator_id,g.white_id,g.black_id,g.status,g.revision,
      g.created_at,g.expires_at,CASE WHEN length(g.state_json)<=2000000 THEN g.state_json ELSE '' END AS state_json FROM mp_games g
      LEFT JOIN mp_summaries s ON s.game_id=g.id
      LEFT JOIN mp_summary_quarantine q ON q.game_id=g.id
      WHERE g.rowid>? AND s.game_id IS NULL AND q.game_id IS NULL ORDER BY g.rowid LIMIT 50`,
      )
      .all(after) as (SummarySource & { sequence: number })[];
    if (!rows.length) break;
    db.transaction(() => {
      for (const row of rows) {
        try {
          update(row);
        } catch (error) {
          if (!(error instanceof MultiplayerStateError)) throw error;
          db.prepare("INSERT OR REPLACE INTO mp_summary_quarantine VALUES(?,?)").run(
            row.id,
            "Invalid multiplayer state; restore or repair required.",
          );
        }
      }
    })();
    after = rows.at(-1)!.sequence;
  }
  function list(user: string): StoredSummary[] {
    const query = db.prepare(`SELECT s.summary_json FROM mp_summary_members m
      JOIN mp_summaries s ON s.game_id=m.game_id
      WHERE m.user_id=? AND m.priority=? ORDER BY m.created_at DESC,m.game_id LIMIT 200`);
    const rows = [0, 1, 2].flatMap((priority) =>
      (query.all(user, priority) as { summary_json: string }[]).map(
        (row) => JSON.parse(row.summary_json) as StoredSummary,
      ),
    );
    const now = Date.now();
    const priority = (row: StoredSummary) =>
      row.status === "active" ? 0 : row.status === "waiting" && row.expiresAt > now ? 1 : 2;
    return rows
      .sort(
        (a, b) =>
          priority(a) - priority(b) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
      )
      .slice(0, 200);
  }
  return { update, list };
}
