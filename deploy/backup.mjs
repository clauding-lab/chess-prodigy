import Database from "better-sqlite3";
import { chmod, mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const directory = process.env.BACKUP_DIR ?? "/var/lib/chess-prodigy/backups";
const databasePath = process.env.DATABASE_PATH ?? "/var/lib/chess-prodigy/chess.sqlite";
const kind = process.env.BACKUP_KIND ?? "manual";
const now = new Date();
const bdt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().replace("Z", "+06:00");
const id = randomUUID();
const partial = join(directory, `.backup-${id}.partial`);
async function status(state) {
  const temporary = join(directory, `.status-${id}.json`);
  await writeFile(temporary, JSON.stringify({ status: state, kind, at: bdt }) + "\n", {
    mode: 0o600,
  });
  await rename(temporary, join(directory, "last-backup-status.json"));
}
try {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (kind !== "daily" && kind !== "manual")
    throw new Error("BACKUP_KIND must be daily or manual.");
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    // SQLite's online backup API includes committed WAL contents consistently.
    await database.backup(partial);
  } finally {
    database.close();
  }
  const backup = new Database(partial, { readonly: true, fileMustExist: true });
  try {
    const checks = backup.pragma("integrity_check");
    if (checks.length !== 1 || checks[0].integrity_check !== "ok")
      throw new Error("Backup integrity check failed.");
  } finally {
    backup.close();
  }
  await chmod(partial, 0o600);
  const name =
    kind === "daily"
      ? `chess-daily-${bdt.slice(0, 10)}.sqlite`
      : `chess-manual-${bdt.replaceAll(":", "-")}-${id}.sqlite`;
  // A repeat daily run replaces only that day's file, after validation.
  await rename(partial, join(directory, name));
  if (kind === "daily") {
    const copies = (await readdir(directory))
      .filter((name) => /^chess-daily-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
      .sort();
    for (const name of copies.slice(0, -14)) await unlink(join(directory, name));
  }
  await status("ok");
  console.log(
    `Chess Prodigy ${kind} backup verified at ${bdt} (BDT). Manual and legacy copies are preserved.`,
  );
} catch (error) {
  // Only remove this invocation's unfinished artifact, never a prior good copy.
  await unlink(partial).catch(() => {});
  await status("failed").catch(() => {});
  console.error(
    "Chess Prodigy backup failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
}
