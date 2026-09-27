// @vitest-environment node
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import {
  initializeLeaderboardProjection,
  readProjectedLeaderboard,
  writeRatingProjection,
} from "../../server/leaderboard";
import { freshSession } from "../../src/game/state";
import { playLine, FOOLS_MATE } from "../game/play-line";

function fixture() {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE user(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT); CREATE TABLE player_records(user_id TEXT PRIMARY KEY,version INTEGER,snapshot TEXT,updated_at TEXT)",
  );
  return db;
}
it("backfills only validated ratings, quarantines bad records and reads a bounded indexed public projection", () => {
  const db = fixture();
  try {
    const snapshot = playLine(freshSession(1000, "synthetic"), FOOLS_MATE, 1001);
    for (let i = 0; i < 500; i++) {
      db.prepare("INSERT INTO user VALUES(?,?,?)").run(
        `u${i}`,
        `Player ${i}`,
        `private${i}@example.test`,
      );
      db.prepare("INSERT INTO player_records VALUES(?,?,?,?)").run(
        `u${i}`,
        1,
        JSON.stringify(snapshot),
        "synthetic",
      );
    }
    db.prepare("INSERT INTO user VALUES(?,?,?)").run("bad", "Bad", "private@example.test");
    db.prepare("INSERT INTO player_records VALUES(?,?,?,?)").run(
      "bad",
      1,
      '{"private":"DO NOT EXPOSE",',
      "synthetic",
    );
    const report = initializeLeaderboardProjection(db);
    expect(report).toEqual({ projected: 500, quarantined: 1 });
    const board = readProjectedLeaderboard(db);
    expect(board.players).toHaveLength(100);
    expect(Object.keys(board.players[0]).sort()).toEqual(["games", "name", "rank", "rating"]);
    expect(JSON.stringify(board)).not.toMatch(/private|DO NOT EXPOSE|snapshot|user_id/);
    expect(initializeLeaderboardProjection(db)).toEqual({ projected: 0, quarantined: 0 });
    const plan = db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT user_id,rating,games FROM player_rating_projection WHERE games>=1 ORDER BY rating DESC,games DESC,user_id ASC LIMIT 100",
      )
      .all();
    expect(JSON.stringify(plan)).toContain("player_rating_rank");
    expect(JSON.stringify(plan)).not.toContain("TEMP B-TREE");
    // Public reads are independent of full private game JSON after projection.
    db.exec("UPDATE player_records SET snapshot='not parsed by leaderboard'");
    expect(readProjectedLeaderboard(db, Date.now() + 3000)).toEqual(board);
  } finally {
    db.close();
  }
});
it("updates the projection atomically with a records transaction and excludes reset ratings", () => {
  const db = fixture();
  try {
    db.prepare("INSERT INTO user VALUES(?,?,?)").run("owner", "Player", "secret@example.test");
    initializeLeaderboardProjection(db);
    const rating = playLine(freshSession(1000, "completed"), FOOLS_MATE, 1001).rating;
    writeRatingProjection(db, "owner", 1, rating);
    expect(readProjectedLeaderboard(db).players).toHaveLength(1);
    expect(() =>
      db.transaction(() => {
        writeRatingProjection(db, "owner", 2, freshSession(0, "reset").rating);
        throw Error("rollback");
      })(),
    ).toThrow("rollback");
    expect(readProjectedLeaderboard(db).players).toHaveLength(1);
    writeRatingProjection(db, "owner", 2, freshSession(0, "reset").rating);
    expect(readProjectedLeaderboard(db).players).toEqual([]);
  } finally {
    db.close();
  }
});
