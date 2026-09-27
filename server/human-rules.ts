import type Database from "better-sqlite3";
import type { Game } from "../src/game/types.js";
import { isDeadPositionV2 } from "../src/engine/rules-v2.js";

export function initializeHumanRules(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(mp_games)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "rules_version"))
    db.exec("ALTER TABLE mp_games ADD COLUMN rules_version INTEGER NOT NULL DEFAULT 1");
}

export function applyHumanDeadPositionRule(game: Game, version: number): Game {
  if (version !== 1 && version !== 2) throw new Error("Unsupported human rules version.");
  if (version === 1 || game.over || !isDeadPositionV2(game.st.board)) return game;
  return { ...game, over: { result: "½-½", reason: "Insufficient material" } };
}
