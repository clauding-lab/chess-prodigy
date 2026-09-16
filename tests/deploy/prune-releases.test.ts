import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  symlinkSync,
  utimesSync,
  lutimesSync,
  existsSync,
  lstatSync,
  realpathSync,
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

// Probed once, at collection time, so the pre-bash-4 regression test below
// can be declared with it.skipIf and show up as an honest "skipped" in the
// report — rather than silently returning early inside the test body and
// reading as a pass on any machine (e.g. an Ubuntu CI image) where
// /bin/bash is already bash 4+.
const bashProbe = spawnSync("/bin/bash", ["-c", "echo ${BASH_VERSINFO[0]}"], { encoding: "utf8" });
const hasPreBash4AtSlashBinBash = bashProbe.status === 0 && Number(bashProbe.stdout.trim()) < 4;

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

  it("never dangles current when it points through a symlink alias INSIDE releases/ (e.g. releases/latest)", () => {
    // Regression test: current -> releases/latest -> releases/<real release>.
    // "latest" is itself just another entry directly under releases/, with
    // its own mtime — nothing before this fix stopped the pruner from
    // treating it as an ordinary release directory and removing it once it
    // fell outside the newest-KEEP window, even though the real release it
    // points to was protected. That leaves $ROOT/current dangling: current
    // still resolves through "latest", but "latest" no longer exists.
    const root = tempDir("chess-prune-alias-");
    const releasesDir = join(root, "releases");
    mkdirSync(releasesDir, { recursive: true });
    const a = makeRelease(releasesDir, "a-oldest", 6);
    const b = makeRelease(releasesDir, "2.4.2-current", 5);
    const c = makeRelease(releasesDir, "c", 4);
    const d = makeRelease(releasesDir, "d", 3);
    const e = makeRelease(releasesDir, "e", 2);
    const f = makeRelease(releasesDir, "f-newest", 1);
    const latest = join(releasesDir, "latest");
    symlinkSync(b, latest);
    // Give the alias its own mtime, outside the newest-KEEP=3 window (d/e/f)
    // and distinct from b, so its survival depends entirely on the alias-
    // chain protection rather than an accident of the newest-KEEP-by-mtime
    // sort.
    lutimesSync(latest, new Date(Date.now() - 5 * HOUR_MS), new Date(Date.now() - 5 * HOUR_MS));
    symlinkSync(latest, join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root });

    expect(result.status).toBe(0);
    // existsSync follows symlinks, so this is false if "current" is left
    // dangling through a deleted "latest" — the core assertion for this
    // residual.
    expect(existsSync(join(root, "current"))).toBe(true);
    expect(lstatSync(latest).isSymbolicLink()).toBe(true);
    expect(existsSync(latest)).toBe(true);
    expect(existsSync(b)).toBe(true);
    expect(existsSync(d)).toBe(true);
    expect(existsSync(e)).toBe(true);
    expect(existsSync(f)).toBe(true);
    expect(existsSync(a)).toBe(false);
    expect(existsSync(c)).toBe(false);
    expect(result.stdout).toMatch(/kept 5 releases, removed 2/);
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

  it("refuses with exit 2 when CHESS_PRODIGY_KEEP is 000", () => {
    const { root } = makeStandardRoot();

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root, CHESS_PRODIGY_KEEP: "000" });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/KEEP/i);
  });

  it("KEEP=08 behaves exactly like KEEP=8 (leading zero must not be read as octal)", () => {
    // Regression test: bash arithmetic contexts (`[[ -lt ]]`, `$(( ))`) read
    // a leading-zero value as octal, and "08" isn't a valid octal digit
    // sequence — that used to fail the -lt validation silently (non-fatal
    // under set -e inside an `if`) and, later, break the newest-KEEP
    // protection loop the same way, keeping nothing beyond current/
    // current-next. See deploy/README.md, "Release retention".
    const root = tempDir("chess-prune-keep-octal-8-");
    const releasesDir = join(root, "releases");
    mkdirSync(releasesDir, { recursive: true });
    // 10 releases named by their age in hours: age01 (newest, 1h) .. age10
    // (oldest, 10h).
    const releases: Record<number, string> = {};
    for (let hoursAgo = 1; hoursAgo <= 10; hoursAgo++) {
      releases[hoursAgo] = makeRelease(
        releasesDir,
        `age${String(hoursAgo).padStart(2, "0")}`,
        hoursAgo,
      );
    }
    // current -> age09, deliberately outside the newest 8 (ages 1h-8h) so
    // its survival depends on current-protection, not just the newest-KEEP
    // window — same rationale as makeStandardRoot().
    symlinkSync(releases[9], join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root, CHESS_PRODIGY_KEEP: "08" });

    expect(result.status).toBe(0);
    for (let hoursAgo = 1; hoursAgo <= 9; hoursAgo++) {
      expect(existsSync(releases[hoursAgo])).toBe(true);
    }
    expect(existsSync(releases[10])).toBe(false);
    expect(result.stdout).toMatch(/kept 9 releases, removed 1/);
  });

  it("KEEP=010 keeps 10 releases, not 8 (decimal normalisation, not octal)", () => {
    const root = tempDir("chess-prune-keep-octal-10-");
    const releasesDir = join(root, "releases");
    mkdirSync(releasesDir, { recursive: true });
    const releases: Record<number, string> = {};
    for (let hoursAgo = 1; hoursAgo <= 12; hoursAgo++) {
      releases[hoursAgo] = makeRelease(
        releasesDir,
        `age${String(hoursAgo).padStart(2, "0")}`,
        hoursAgo,
      );
    }
    symlinkSync(releases[1], join(root, "current"));

    const result = runPrune([], { CHESS_PRODIGY_ROOT: root, CHESS_PRODIGY_KEEP: "010" });

    expect(result.status).toBe(0);
    for (let hoursAgo = 1; hoursAgo <= 10; hoursAgo++) {
      expect(existsSync(releases[hoursAgo])).toBe(true);
    }
    expect(existsSync(releases[11])).toBe(false);
    expect(existsSync(releases[12])).toBe(false);
    expect(result.stdout).toMatch(/kept 10 releases, removed 2/);
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

  it("refuses with exit 2 when CHESS_PRODIGY_STAGE_MAX_AGE_HOURS is not a plain integer, before any deletion", () => {
    const { root, a, b, c, d, e, f } = makeStandardRoot();
    const stageBase = tempDir("chess-prune-stage-badage-");
    const staleDir = join(stageBase, "chess-foo-stage.111");
    mkdirSync(staleDir, { recursive: true });
    setMtime(staleDir, 999);

    const result = runPrune([], {
      CHESS_PRODIGY_ROOT: root,
      CHESS_PRODIGY_STAGE_GLOB: join(stageBase, "chess-*-stage.*"),
      CHESS_PRODIGY_STAGE_MAX_AGE_HOURS: "abc",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/CHESS_PRODIGY_STAGE_MAX_AGE_HOURS/);
    // Nothing was deleted: all releases survive and the (very stale) stage
    // dir survives too, proving validation ran before any deletion loop.
    for (const dir of [a, b, c, d, e, f]) {
      expect(existsSync(dir)).toBe(true);
    }
    expect(existsSync(staleDir)).toBe(true);
  });

  it("STAGE_MAX_AGE_HOURS=024 works as 24, not octal 20", () => {
    const { root } = makeStandardRoot();
    const stageBase = tempDir("chess-prune-stage-octal-");
    // 22h old: younger than the real threshold (24h) but older than the
    // buggy octal-parsed one ("024" as octal = 20h) — so this dir only
    // survives if "024" is read as decimal 24, not octal 20.
    const borderlineDir = join(stageBase, "chess-borderline-stage.1");
    mkdirSync(borderlineDir, { recursive: true });
    setMtime(borderlineDir, 22);
    const staleDir = join(stageBase, "chess-stale-stage.2");
    mkdirSync(staleDir, { recursive: true });
    setMtime(staleDir, 30);

    const result = runPrune([], {
      CHESS_PRODIGY_ROOT: root,
      CHESS_PRODIGY_STAGE_GLOB: join(stageBase, "chess-*-stage.*"),
      CHESS_PRODIGY_STAGE_MAX_AGE_HOURS: "024",
    });

    expect(result.status).toBe(0);
    expect(existsSync(borderlineDir)).toBe(true);
    expect(existsSync(staleDir)).toBe(false);
    expect(result.stdout).toMatch(/stage dirs removed 1/);
  });

  it("tolerates a release or stage dir vanishing between the glob and the mtime stat, and still prints the summary", () => {
    // A genuine glob-then-vanish race is not reproducible deterministically,
    // so this forces the same failure mode with a fake `stat` ahead of the
    // real one on PATH: it fails (both the GNU -c and BSD -f forms
    // mtime_of tries) for exactly the two "vanished" paths below, and
    // delegates to the real stat for everything else. Before this fix, a
    // failed mtime_of fed straight into `age=$((... $(mtime_of ...)))`
    // produced a bash arithmetic syntax error, which aborted the whole
    // script under set -e with no summary line.
    const { root, a, b, c, d, e, f } = makeStandardRoot();
    const stageBase = tempDir("chess-prune-stat-race-stage-");
    const staleStageDir = join(stageBase, "chess-foo-stage.1");
    const raceStageDir = join(stageBase, "chess-bar-stage.2");
    mkdirSync(staleStageDir, { recursive: true });
    setMtime(staleStageDir, 30);
    mkdirSync(raceStageDir, { recursive: true });
    setMtime(raceStageDir, 30);

    const fakeBinDir = tempDir("chess-prune-fake-bin-");
    const fakeStatPath = join(fakeBinDir, "stat");
    writeFileSync(
      fakeStatPath,
      [
        "#!/usr/bin/env bash",
        'for arg in "$@"; do',
        '  if [[ "$arg" == "$FAKE_STAT_FAIL_PATH_1" || "$arg" == "$FAKE_STAT_FAIL_PATH_2" ]]; then',
        "    exit 1",
        "  fi",
        "done",
        'exec /usr/bin/stat "$@"',
        "",
      ].join("\n"),
    );
    chmodSync(fakeStatPath, 0o755);

    const result = runPrune([], {
      CHESS_PRODIGY_ROOT: root,
      CHESS_PRODIGY_STAGE_GLOB: join(stageBase, "chess-*-stage.*"),
      PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      // The script canonicalizes CHESS_PRODIGY_ROOT (and so releases/) with
      // `cd && pwd -P` before building release paths — on macOS os.tmpdir()
      // sits under /var/folders, itself a symlink to /private/var/folders,
      // so the release-dir victim must be passed in its resolved form to
      // match what the script actually hands to `stat`. The stage-dir glob
      // is never canonicalized by the script, so that victim stays as-is.
      FAKE_STAT_FAIL_PATH_1: realpathSync(c),
      FAKE_STAT_FAIL_PATH_2: raceStageDir,
    });

    expect(result.status).toBe(0);
    // c's mtime could not be read this run, so it was skipped (never even
    // considered for removal) instead of aborting the script — the script
    // reaches its summary line rather than dying mid-loop.
    expect(existsSync(c)).toBe(true);
    expect(existsSync(a)).toBe(true);
    expect(existsSync(b)).toBe(true);
    expect(existsSync(d)).toBe(true);
    expect(existsSync(e)).toBe(true);
    expect(existsSync(f)).toBe(true);
    // The stage dir whose stat failed is likewise skipped and survives...
    expect(existsSync(raceStageDir)).toBe(true);
    // ...while the genuinely stale one (real stat succeeds for it) is still
    // removed as normal.
    expect(existsSync(staleStageDir)).toBe(false);
    expect(result.stdout).toMatch(/prune: kept 5 releases, removed 0/);
    expect(result.stdout).toMatch(/stage dirs removed 1/);
  });

  it.skipIf(!hasPreBash4AtSlashBinBash)(
    "exits 3 (not the policy-refusal code 2) under a pre-bash-4 interpreter, distinguishing an environment issue from a refusal [skipped when /bin/bash is already >= 4, e.g. on CI images that ship a modern bash at that path — nothing to prove there]",
    () => {
      // /bin/bash is stock bash 3.2 on macOS (pre-installed, distinct from a
      // Homebrew bash 5+ that may be first on PATH) — a real, already-present
      // interpreter to prove the version guard fires, not a synthetic stub.
      const { root } = makeStandardRoot();

      const result = spawnSync("/bin/bash", [SCRIPT], {
        encoding: "utf8",
        timeout: 15000,
        env: { ...process.env, CHESS_PRODIGY_ROOT: root },
      });

      expect(result.status).toBe(3);
      expect(result.stderr).toMatch(/bash/i);
      expect(result.stderr).not.toMatch(/refus/i);
    },
  );
});
