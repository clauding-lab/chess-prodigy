// @vitest-environment node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, expect, it } from "vitest";
const run = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "chess-backup-test-"));
  directories.push(directory);
  const path = join(directory, "source.sqlite");
  const db = new Database(path);
  db.pragma("journal_mode=WAL");
  db.exec(
    "CREATE TABLE synthetic (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO synthetic VALUES (1, 'committed WAL content')",
  );
  return {
    directory,
    path,
    db,
    invoke: (kind: string) =>
      run(process.execPath, ["deploy/backup.mjs"], {
        timeout: 15000,
        env: { ...process.env, DATABASE_PATH: path, BACKUP_DIR: directory, BACKUP_KIND: kind },
      }),
  };
}
it("verifies a consistent WAL backup and restores synthetic data in isolation", async () => {
  const f = await fixture();
  try {
    await f.invoke("daily");
    const files = await readdir(f.directory);
    const backup = files.find((name) => /^chess-daily-.*\.sqlite$/.test(name));
    expect(backup).toBeDefined();
    const restored = join(f.directory, "restored.sqlite");
    await copyFile(join(f.directory, backup!), restored);
    const db = new Database(restored);
    try {
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(db.prepare("SELECT value FROM synthetic").pluck().get()).toBe("committed WAL content");
    } finally {
      db.close();
    }
    expect(
      JSON.parse(await readFile(join(f.directory, "last-backup-status.json"), "utf8")).status,
    ).toBe("ok");
  } finally {
    f.db.close();
  }
});
it("retains manual and legacy backups separately from fourteen daily dates", async () => {
  const f = await fixture();
  try {
    for (let i = 1; i <= 20; i++)
      await writeFile(
        join(f.directory, `chess-daily-2020-01-${String(i).padStart(2, "0")}.sqlite`),
        "retained fixture",
      );
    await writeFile(join(f.directory, "chess-2020-01-01T00-00-00.000Z.sqlite"), "legacy protected");
    await f.invoke("manual");
    await f.invoke("daily");
    await f.invoke("daily");
    const files = await readdir(f.directory);
    expect(files.filter((name) => name.startsWith("chess-daily-"))).toHaveLength(14);
    expect(files.filter((name) => name.startsWith("chess-manual-"))).toHaveLength(1);
    expect(await readFile(join(f.directory, "chess-2020-01-01T00-00-00.000Z.sqlite"), "utf8")).toBe(
      "legacy protected",
    );
  } finally {
    f.db.close();
  }
});
it("records a visible failure and preserves prior good backups on a corrupt source", async () => {
  const f = await fixture();
  await f.invoke("manual");
  f.db.close();
  const before = (await readdir(f.directory)).filter((name) => name.startsWith("chess-"));
  await writeFile(f.path, "not a database");
  await expect(f.invoke("daily")).rejects.toThrow();
  expect((await readdir(f.directory)).filter((name) => name.startsWith("chess-"))).toEqual(before);
  expect(
    JSON.parse(await readFile(join(f.directory, "last-backup-status.json"), "utf8")).status,
  ).toBe("failed");
});
