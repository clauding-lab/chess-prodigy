# Personality PWA — Run 2 verification

11 September 2026 BDT. Scope: next bounded Run 2 after owner “go on”; handoff revision 2.
Plan: `docs/plans/2026-09-11-personality-pwa-run2.md`.

Persistent checkout `/Users/adnanrashid/Projects/chess-prodigy`, branch
`codex/personality-pwa-run2`, base `8a5a472f7301b4794d3f6a99ab2c03a4b749c0a1`.
No pre-existing changes. Node 22.23.0 / npm 10.9.8. No production access or release actions.

## Baseline — passed (R2.0)

| Command | Result |
| --- | --- |
| `npm test` | exit 0; 247 tests / 28 files |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:browser` | exit 0; 52 passed, 4 existing intentional skips |
| `npm run test:accessibility` against preview 4173 | exit 0; both themes 100 |
| `git diff --check` | exit 0 before checkpoint commit |

R2.0 complete (`48ee845`); R2.1 complete (`266d3b2`); R2.2 complete (`a8cc009`);
R2.3 implemented and canonical checks passed; supplemental WebKit offline checks blocked.
Recovery verified; local closeout recorded below. Run 3 deferred.
Carried baseline limitation: WebKit offline new-page navigation failed identically on
Run 1 and untouched `f2b45b7`; physical iPhone checks remain pending.

Baseline logs: `/tmp/chess-prodigy-run2/baseline-*.log`. Browser-generated screenshots
were retained there and the four tracked baseline images restored. Browser skips are the
same account/mobile and touch-only duplicates recorded in Run 1. Frontend preview's missing
optional API on 4317 causes expected proxy diagnostics; account tests use disposable 4318.
No application, test, configuration or schema edits preceded this record and baseline.

## R2.1 — identity, migration and rating foundation

- Red-first checks failed for missing new configuration/migration APIs (`r21-red.log`).
- Focused final game/storage/account-sync/server checks: exit 0, **90 tests / 8 files**.
  Archive legacy-projection check: exit 0, **1 test / 1 file** (`r21-record-tests.log`).
- Typecheck, lint, format and diff checks: exit 0. A formatting failure in server/records.ts
  was corrected normally; no hooks/checks bypassed.
- Interim full unit/server/UI suite before the last two review regressions: exit 0,
  **259 tests / 30 files**. Final run verification still pending; browser assertions were
  mechanically updated to observe v2 authoritative keys, with dedicated v1 migration fixtures.
- Two independent reviewers checked schema, rating, local caches, queue durability, server
  ownership/version transaction and archive undo/recompletion. Data-path reviewer reproduced
  stale annotations on unsupported config. Added failing test (`r21-review-red.log`), removed
  the normalization bypass, and passed the final focused tests. TypeScript review: no findings.
- Beta terminal/undo/recompletion preserves seed/config and zero rating/leaderboard effects.
  Unknown-version StrictMode hook test: no worker, clock settlement, reset, replacement or write.

Logs under `/tmp/chess-prodigy-run2/r21-*.log`. Actual branch/base unchanged. No unrelated files
or pre-existing work were encountered. Supported-config UI/engine play is not yet implemented.
Migration/rollback details are in the plan. No new SQL tables, production access or external calls.

## R2.2 — bounded Morphy engine and worker/book integration

- Red-first suite initially failed for the absent implementation (`r22-red.log`).
- Final focused engine/worker/live-hook suite: exit 0, **85 tests / 7 files** (`r22-tests.log`).
- Typecheck, lint, format and diff checks: exit 0 (`r22-*.log`).
- Existing reviewer independence tests now include actual Classic/Morphy configuration and
  a real Morphy request before neutral review in the same worker handler. Live/persisted-cache
  and recomputation regressions remain in the focused engine and hook suites.
- Complete deterministic initial-board games: seed 4 draw at 109 plies, seed 5 draw at 30,
  seed 6 checkmate at 68. A 300-ply unfinished game fails the test. Initial seeds 1/42/2026
  converged to the same 71-ply mate; changed smoke inputs to cover distinct opening trajectories.
- Two fixture assumptions were corrected from observed legal/search evidence: the original
  “only legal” position actually had two escapes; the replacement asserts exactly one.
  A queen-exchange expectation rejected a stronger rook fork; the held-out test now compares
  the choice with that winning simplification using neutral review. No engine retuning for these.
- Independent code/data-path reviewer passed 30 engine/reviewer/worker tests; TypeScript
  reviewer reran typecheck/lint. Both report no remaining actionable findings.

## R2.3 — UI and safety integration (canonical checks passed)

- Red-first UI suite: 4 failed before implementation (`r23-red.log`).
- UI/live-hook recovery checks: exit 0, 26 tests / 2 files; includes flag-off creation guard,
  both-colour resume, pre-first-move beta resume, immutable unavailable versions and explicit
  recovery-before-update (`r23-recovery-tests.log`).
- Latest full unit/UI/server suite: **285 tests / 33 files, exit 0** (`final-tests.log`).
  Typecheck, lint and format: exit 0 (`final-*.log`); explicit browser-file formatting/TypeScript
  lint also pass. Canonical ESLint excludes tests; explicit TypeScript recommended rules are used.
- Initial native Chrome beta test: 6 passed / 4 failed because the new test incorrectly expected
  prompt-mode service-worker control before navigation. Changed the test to await installation,
  navigate normally offline, then verify control. No app update policy changed. Retained failure
  traces under `/tmp/chess-prodigy-run2/initial-browser-failures/`.
- Corrected Chrome flag-off journey suite: **10 passed** (`r23-browser-off-rerun.log`).
  Initial flag-on suite: 10 passed. Added wood setup axe coverage exposed label contrast at
  3.77:1; scoped opacity fix; final enabled suite: **10 passed** (`final-browser-on-rerun.log`).
- Independent data-path/TypeScript reviews approved UI and final mixed-schema guard. The latter
  was reproduced red (`r23-mixed-schema-red.log`); reviewer independently passed 21 migration/
  server tests. Final opacity/browser-test delta reviewed with no actionable findings.
- Wall-clock out-of-book probe: Casual 18/200 ms, Club 59/600 ms, Strong 1302/2000 ms;
  exit 0 (`morphy-wallclock.log`). This is one measured position, not a strength/performance claim.
- WebKit mobile enabled beta subset: **2 passed / 2 failed**, exit 1 (`webkit-beta.log`).
  Selection in both themes and recovery download pass; both offline reload journeys fail with
  `WebKit encountered an internal error` at `personality.spec.ts` offline `page.reload()`.
  This matches the error class of the retained pre-Run-1 offline navigation limitation. These
  journeys are BLOCKED, not green. Separate online Classic/Morphy reviewer checks both pass
  (2 tests, `webkit-reviewer.log`), including real opponent-score injection, reload cleanup and
  explicit recomputation. Native tests now assert expected identity and a full nonempty cache.

First final canonical browser pass: **60 passed, 4 failed, 4 skipped** (`final-browser.log`).
The failures were two stale expectations in both viewports: lowercase `unrated` versus the
intentional `Unrated game (hint used)` copy, and recovery expecting schema 1 instead of schema 2.
Corrected these exact assertions; original corrupt bytes and hint eligibility behaviour were
already correct in the captured output. No app changes or relaxed checks. Full rerun passed:
**64 passed, 4 existing intentional skips, exit 0** (`final-browser-rerun.log`). Preserved traces
under `full-browser-first-failures/` in the task log directory. Skips: three duplicate mobile
account journeys and one desktop touch-only sound journey.

Lighthouse initially failed because its wait predicate still read the v1 key (`final-accessibility.log`).
Updated only that predicate to wait safely for the v2 authoritative save. Independent TypeScript
review found no issues; `node --check scripts/check-accessibility.mjs` passed. Rerun: **wood 100,
dark 100, exit 0** (`final-accessibility-rerun.log`). Final strengthened native WebKit online
reviewer checks: **2 passed, exit 0** (`webkit-reviewer-final.log`). Offline WebKit remains blocked.

Final ordinary production build has the beta flag off. All 285 unit/UI/server tests, typecheck,
lint, formatting, build, 64 canonical browser checks and Lighthouse passed. No claim of full
cross-browser or physical-device verification: WebKit offline navigation and physical iPhone
checks remain outstanding. Strength calibration and public commercial naming clearance are deferred.
Four generated tracked screenshots were copied into recovery evidence and restored to their prior
versions; retained baseline imagery is not presented as new-device evidence.

## Final checkpoint and recovery

Verified application HEAD: `e05ff7c526e50fc4da0ab7155c0f56c14921a1fd`.
Checkpoint commits: `48ee845` (baseline), `266d3b2` (save/rating foundation),
`a8cc009` (engine), `e05ff7c` (UI and final checks). A documentation-only closeout follows;
its exact final HEAD is recorded in the external recovery README to avoid a self-reference.
After the application commit the tracked/staged/untracked diff was empty; only the two records
are changed for this closeout. No unfinished application diff remains. Main stays at
`f2b45b701795ea2aa03e89688ced04b8106b5928`; no remote/release/live-data actions occurred.

Owner-accessible recovery: `/Users/adnanrashid/Downloads/chess-prodigy-run2-recovery-2026-09-11/`.
`run2.bundle` contains task commits and requires `8a5a472f7301b4794d3f6a99ab2c03a4b749c0a1`;
`git bundle verify` passed. `run2.patch` passed `git apply --check` against the untouched Run 2
base archive at `/tmp/chess-prodigy-run2/recovery-base`. Artifacts are refreshed and reverified
after the documentation closeout. Copies of both records, final logs, Lighthouse reports and
synthetic screenshots accompany them. No private database, credentials or player data included.
Local persistent recovery is not off-device backup; Run 1 has its separate recovery export.

Migration: real v1 saves become Classic v2 deterministically; original keys and rating receipts
are retained. Present corrupt v2 never silently falls back. Account queues are made durable
before sending, and accepted v2 account state rejects v1 downgrade writes. Unknown opponent
versions stay read-only with recovery download. Beta outcomes have no rating effects. There
was no SQL table migration or rewrite of an existing player database.

Verified: canonical full suite and the selected Run 2 Chrome journeys. Blocked: WebKit offline
navigation; physical iPhone verification remains pending. Deferred: strength calibration, public
commercial naming clearance, Run 3 rivalry/replay/richer results/rematch and later milestones.
Next exact task: on a separately requested continuation, investigate retained baseline/current
WebKit offline navigation failures without forcing active-game updates. Run 3 requires a separate
invocation and the remaining A4/A5/full Milestone A acceptance work. Stop here.
