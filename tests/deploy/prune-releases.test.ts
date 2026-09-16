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
  // Default CHESS_PRODIGY_STAGE_GLOB to an empty, never-created sandbox
  // directory unless the caller overrides it. Without this, a test that
  // omits the var inherits the script's real production default
  // (/tmp/chess-*-stage.*) and deletes whatever staging directories a real
  // deploy session left on THIS machine's actual /tmp — verified: an
  // unrelated /tmp/chess-*-stage.* directory disappeared during a plain
  // `npm test` run before this default was added.
  const defaultEnv: Record<string, string> = {};
  if (!("CHESS_PRODIGY_STAGE_GLOB" in env)) {
    const sandbox = tempDir("chess-prune-stage-sandbox-");
    defaultEnv.CHESS_PRODIGY_STAGE_GLOB = join(sandbox, "chess-*-stage.*");
  }
  return spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    timeout: 15000,
    env: { ...process.env, ...defaultEnv, ...env },
  });
}

/**
 * Builds a standard six-release layout:
 *   a (oldest, 6h) b (5h) c (4h) d (3h) e (2h) f (newest, 1h)
 * current -> b (deliberately OUTSIDE the newest KEEP=3, which is d/e/f) so
 * that a passing test actually exercises current-protection rather than
 * protection current would already get from being newest-KEEP anyway.
 * current-next -> a (the oldest, also outside the newest KEEP).
 * With the default KEEP=3: newest three (f, e, d) + current (b) +
 * current-next (a) must survive; only c must go.
 */
function makeStandardRoot() {
  const root = tempDir("chess-prune-root-");
  const releasesDir = join(root, "releases");
  mkdirSync(releasesDir, { recursive: true });
  const a = makeRelease(releasesDir, "a-oldest", 6);
  const b = makeRelease(releasesDir, "b-current", 5);
  const c = makeRelease(releasesDir, "c", 4);
  const d = makeRelease(releasesDir, "d", 3);
  const e = makeRelease(releasesDir, "e", 2);
  const f = makeRelease(releasesDir, "f-newest", 1);
  symlinkSync(b, join(root, "current"));
  symlinkSync(a, join(root, "current-next"));
  return { root, releasesDir, a, b, c, d, e, f };
}

describe("deploy/prune-releases.sh", () => {
  it("keeps the 3 newest releases plus current (even though older than the newest 3) and current-next, removes only what's left", () => {
    const { root, a, b, c, d, e, f } = makeStandardRoot();

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(0);
    expect(existsSync(a)).toBe(true);
    expect(existsSync(b)).toBe(true);
    expect(existsSync(d)).toBe(true);
    expect(existsSync(e)).toBe(true);
    expect(existsSync(f)).toBe(true);
    expect(existsSync(c)).toBe(false);
    expect(result.stdout).toMatch(/prune: removed .*[/\\]c\b/);
    expect(result.stdout).toMatch(/kept 5 releases, removed 1/);
  });

  it("protects current even when CHESS_PRODIGY_KEEP=1 and current is the oldest release (dies on any regression to current-protection)", () => {
    const root = tempDir("chess-prune-keep1-");
    const releasesDir = join(root, "releases");
    mkdirSync(releasesDir, { recursive: true });
    const oldest = makeRelease(releasesDir, "oldest-current", 3);
    const mid = makeRelease(releasesDir, "mid", 2);
    const newest = makeRelease(releasesDir, "newest", 1);
    symlinkSync(oldest, join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root, CHESS_PRODIGY_KEEP: "1" });

    expect(result.status).toBe(0);
    // The newest-1 rule alone would only keep "newest"; current-protection
    // is the only thing that can save "oldest".
    expect(existsSync(oldest)).toBe(true);
    expect(existsSync(newest)).toBe(true);
    expect(existsSync(mid)).toBe(false);
    expect(result.stdout).toMatch(/kept 2 releases, removed 1/);
  });

  it("never deletes the live release when releases/ is itself a symlink to another volume", () => {
    // Regression test: an operator relocating /opt/chess-prodigy/releases
    // onto a larger volume (the standard response to a full root disk —
    // exactly the incident this timer exists to prevent) and leaving a
    // symlink behind used to make current-protection silently fail,
    // because current_real (fully resolved via readlink -f) never matched
    // the unresolved "$ROOT/releases/*" glob entries.
    const root = tempDir("chess-prune-symlink-root-");
    const actualReleases = tempDir("chess-prune-symlink-actual-");
    const a = makeRelease(actualReleases, "a-oldest", 6);
    const b = makeRelease(actualReleases, "b-current", 5);
    const c = makeRelease(actualReleases, "c", 4);
    const d = makeRelease(actualReleases, "d", 3);
    const e = makeRelease(actualReleases, "e", 2);
    const f = makeRelease(actualReleases, "f-newest", 1);
    symlinkSync(actualReleases, join(root, "releases"));
    // current points at b, which is deliberately outside the newest
    // KEEP=3 (d, e, f) so its survival depends entirely on current
    // resolving correctly through the releases-level symlink.
    symlinkSync(b, join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(0);
    expect(existsSync(b)).toBe(true);
    expect(existsSync(d)).toBe(true);
    expect(existsSync(e)).toBe(true);
    expect(existsSync(f)).toBe(true);
    expect(existsSync(a)).toBe(false);
    expect(existsSync(c)).toBe(false);
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

  it("exits 3 (not the policy-refusal code 2) under a pre-bash-4 interpreter, distinguishing an environment issue from a refusal", () => {
    // /bin/bash is stock bash 3.2 on macOS (pre-installed, distinct from a
    // Homebrew bash 5+ that may be first on PATH) — a real, already-present
    // interpreter to prove the version guard fires, not a synthetic stub.
    const probe = spawnSync("/bin/bash", ["-c", "echo ${BASH_VERSINFO[0]}"], { encoding: "utf8" });
    if (probe.status !== 0 || Number(probe.stdout.trim()) >= 4) {
      return; // environment has no pre-bash-4 interpreter at this path; nothing to prove here
    }
    const { root } = makeStandardRoot();

    const result = spawnSync("/bin/bash", [SCRIPT], {
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, CHESS_PRODIGY_ROOT: root },
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toMatch(/bash/i);
    expect(result.stderr).not.toMatch(/refus/i);
  });
});
