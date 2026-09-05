import Database from "better-sqlite3";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const directory = process.env.BACKUP_DIR ?? "/var/lib/chess-prodigy/backups";
const databasePath = process.env.DATABASE_PATH ?? "/var/lib/chess-prodigy/chess.sqlite";
await mkdir(directory, { recursive: true, mode: 0o700 });
const date = new Date().toISOString().replaceAll(":", "-");
const database = new Database(databasePath, { readonly: true, fileMustExist: true });
try {
  // SQLite's online backup API includes committed WAL contents consistently.
  await database.backup(join(directory, `chess-${date}.sqlite`));
} finally {
  database.close();
}
const copies = (await readdir(directory))
  .filter((name) => /^chess-\d{4}-\d{2}-\d{2}T[\d.-]+Z\.sqlite$/.test(name))
  .sort();
for (const name of copies.slice(0, -14)) await unlink(join(directory, name));
console.log("Chess Prodigy backup complete; retained up to 14 daily copies.");
