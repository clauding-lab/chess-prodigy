import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  utimesSync,
  lutimesSync,
  existsSync,
  lstatSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "..", "..", "deploy", "prune-releases.sh");

const HOUR_MS = 60 * 60 * 1000;
const cleanupDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setMtime(path: string, hoursAgo: number) {
  const t = new Date(Date.now() - hoursAgo * HOUR_MS);
  utimesSync(path, t, t);
}

function makeRelease(releasesDir: string, name: string, hoursAgo: number): string {
  const dir = join(releasesDir, name);
  mkdirSync(dir, { recursive: true });
  setMtime(dir, hoursAgo);
  return dir;
}

function runPrune(args: string[], env: Record<string, string>) {
  return spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

/**
 * Builds a standard six-release layout:
 *   a (oldest, 6h) b (5h) c (4h) d (3h) e (2h) f (newest, 1h)
 * current -> d (the 3rd newest), current-next -> a (the oldest).
 * With the default KEEP=3, the newest three (f, e, d) plus current (d,
 * already included) plus current-next (a) must survive; b and c must go.
 */
function makeStandardRoot() {
  const root = tempDir("chess-prune-root-");
  const releasesDir = join(root, "releases");
  mkdirSync(releasesDir, { recursive: true });
  const a = makeRelease(releasesDir, "a-oldest", 6);
  const b = makeRelease(releasesDir, "b", 5);
  const c = makeRelease(releasesDir, "c", 4);
  const d = makeRelease(releasesDir, "d-current", 3);
  const e = makeRelease(releasesDir, "e", 2);
  const f = makeRelease(releasesDir, "f-newest", 1);
  symlinkSync(d, join(root, "current"));
  symlinkSync(a, join(root, "current-next"));
  return { root, releasesDir, a, b, c, d, e, f };
}

describe("deploy/prune-releases.sh", () => {
  it("keeps the 3 newest releases plus current and current-next, removes the rest", () => {
    const { root, a, b, c, d, e, f } = makeStandardRoot();

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(0);
    expect(existsSync(a)).toBe(true);
    expect(existsSync(d)).toBe(true);
    expect(existsSync(e)).toBe(true);
    expect(existsSync(f)).toBe(true);
    expect(existsSync(b)).toBe(false);
    expect(existsSync(c)).toBe(false);
    expect(result.stdout).toMatch(/prune: removed .*[/\\]b\b/);
    expect(result.stdout).toMatch(/prune: removed .*[/\\]c\b/);
    expect(result.stdout).toMatch(/kept 4 releases, removed 2/);
  });

  it("--dry-run removes nothing and exits 0", () => {
    const { root, a, b, c, d, e, f } = makeStandardRoot();

    const result = runPrune(["--dry-run"], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(0);
    for (const dir of [a, b, c, d, e, f]) {
      expect(existsSync(dir)).toBe(true);
    }
    expect(result.stdout).toMatch(/would remove/);
  });

  it("refuses with exit 2 when releases directory is missing", () => {
    const root = tempDir("chess-prune-noreleases-");

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/releases/i);
  });

  it("refuses with exit 2 when current resolves outside releases", () => {
    const root = tempDir("chess-prune-outside-");
    const releasesDir = join(root, "releases");
    mkdirSync(releasesDir, { recursive: true });
    makeRelease(releasesDir, "only-release", 1);
    const outsideDir = tempDir("chess-prune-external-");
    symlinkSync(outsideDir, join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/current/i);
  });

  it("refuses with exit 2 when CHESS_PRODIGY_KEEP is 0", () => {
    const { root } = makeStandardRoot();

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root, CHESS_PRODIGY_KEEP: "0" });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/KEEP/i);
  });

  it("removes stale stage directories older than the max age but keeps fresh ones and symlinks", () => {
    const { root } = makeStandardRoot();
    const stageBase = tempDir("chess-prune-stage-");
    const staleDir = join(stageBase, "chess-foo-stage.111");
    const freshDir = join(stageBase, "chess-bar-stage.222");
    // Named so it does NOT itself match CHESS_PRODIGY_STAGE_GLOB below —
    // only the symlink that points at it should be considered by the glob.
    const staleSymlinkTarget = join(stageBase, "symlink-target-not-glob-matched");
    const staleSymlink = join(stageBase, "chess-baz-stage.444");

    mkdirSync(staleDir, { recursive: true });
    setMtime(staleDir, 30);
    mkdirSync(freshDir, { recursive: true });
    setMtime(freshDir, 1);
    mkdirSync(staleSymlinkTarget, { recursive: true });
    setMtime(staleSymlinkTarget, 30);
    symlinkSync(staleSymlinkTarget, staleSymlink);
    lutimesSync(
      staleSymlink,
      new Date(Date.now() - 30 * HOUR_MS),
      new Date(Date.now() - 30 * HOUR_MS),
    );

    const result = runPrune([], {
      CHESS_PRODIGY_ROOT: root,
      CHESS_PRODIGY_STAGE_GLOB: join(stageBase, "chess-*-stage.*"),
      CHESS_PRODIGY_STAGE_MAX_AGE_HOURS: "24",
    });

    expect(result.status).toBe(0);
    expect(existsSync(staleDir)).toBe(false);
    expect(existsSync(freshDir)).toBe(true);
    expect(() => lstatSync(staleSymlink)).not.toThrow();
    expect(result.stdout).toMatch(/stage dirs removed 1/);
  });
});
