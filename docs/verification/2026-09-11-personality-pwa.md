# Personality PWA — Run 1 verification

Current status: A0, A1a, A1b and the browser regression are verified locally. Full cross-browser
verification remains BLOCKED by the reproduced baseline WebKit offline-navigation failure.
Run 2 and all personality implementation remain DEFERRED. Latest application-code commit:
`f941d25`; final documentation/test checkpoint is recorded below and by Git HEAD.

11 September 2026 BDT. Owner handoff revision 2 confirmed. This is local Run 1 evidence,
not a release claim. Plan: `docs/plans/2026-09-11-personality-pwa.md`.

## Environment and preservation

Persistent Mac checkout `/Users/adnanrashid/Projects/chess-prodigy`;
branch `codex/personality-pwa-run1`; base `f2b45b701795ea2aa03e89688ced04b8106b5928`.
Initial index/worktree clean; no unrelated changes. Node 22.23.0 / npm 10.9.8.
Tests must use synthetic guests/disposable databases; no production data or notification dispatch.

## Baseline — verified

These commands were run on the starting checkout, before implementation:

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm test` | exit 0; 225 tests |
| `npm run build` | exit 0 |
| `npm run test:browser` | exit 0; 50 passed, 4 intentional skips |
| `npm run test:accessibility` (isolated preview 4173) | exit 0; wood 100, dark 100 |
| `git diff --check` | exit 0 |

## Initial checkpoint plan (historical)

- A0 in-progress; A1a/A1b/final not-started; A2 onward deferred.
- Latest verified code commit: baseline only, not reverified yet.
- Findings from inspection: opponent scores currently enter `game.evals`; existing annotations
  are never recomputed; provenance-free saves retain those derived scores; timeout always
  awards the other colour a win. These require regression evidence before fixes.
- No blockers yet. Physical-device checks remain pending; automation cannot prove audibility.

## Migration/recovery

Design pending baseline: preserve game moves, stories, clocks, results, receipts, account
ownership and pending-sync versions. Invalidate only untrusted derived review data.
No schema deployment or rollout authorized. Persistent checkout requires no disposable export.

Next exact action: baseline checks, then failing A1 regressions. Update this record at each checkpoint.

## A0 checkpoint — verified, 11 September 2026 BDT

Baseline commands all exited 0: typecheck, lint, format:check, npm test (225/225 in 26 files), build, test:browser (50 passed; four existing intentional skips), test:accessibility (wood 100, dark 100), git diff --check. Logs: `/tmp/chess-prodigy-run1/baseline-*.log` (local temporary evidence). Browser-generated tracked screenshots are restored after retaining task-run copies in that directory; no initial owner changes existed. Expected frontend-only preview API connection refusals and disposable auth IP warning were observed, not test failures. No dependency install or configuration edit. A0 documentation checked for scope and whitespace.

A1a is now in-progress: add failing review provenance/legacy/annotation regressions, then implement. No blockers. A2 onward remains deferred.

## A1a checkpoint — verified, 11 September 2026 BDT

A0 commit: `4d4b016` (documentation and measured baseline). Source handoff retained unchanged
as `CHESS_PRODIGY_BUILD_HANDOFF.md`; AGENTS/VISION carry only a narrow local-scope pointer.

Implemented neutral reviewer adapter `custom-neutral-v1`; fixed policies `review-v1` (depth 3,
180 ms) and `hint-v1` (depth 4, 900 ms). Hint results do not populate the review cache.
Provenance includes purpose, reviewer, policy, White-perspective score, completed depth, full
FEN and a bounded 64-bit history fingerprint. Worker/client/reducer reject incompatible work.
Only completed comparable review pairs get annotations; UI identifies incomplete analysis.
Explicit review recomputes cached verdicts; stale/cancelled/undo/new/unmounted work is rejected.
Multiplayer completed-review identity is keyed without changing human-game rules.

Initial regression run exited 1 with exactly three expected failures (opponent contamination,
legacy cache retention, retained old annotation); 30 existing checks passed. Then 189 focused
checks in 16 files passed (exit 0), typecheck/lint/format:check/diff checks exited 0. Commands:
`npm test -- tests/engine tests/coach tests/game tests/storage tests/worker tests/account tests/server/accounts.test.ts`,
`npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check`.
Logs: `/tmp/chess-prodigy-run1/a1-checkpoint-*.log`. Four independence requirements are covered
in reviewer, worker-client, storage, account and live useGame tests. Both-colour test-only biased
rook choices lose at least 1000 centipawns under deterministic neutral depth-3 review.

Independent code and TypeScript reviews approved the complete path after two fixes: malformed
policy metadata (new regression failed before fix), and repeated prefix hashing. Reviewer
verified every prefix through 500 plies; measured one 500-ply annotation pass about 16 ms after
optimization versus 308 ms before. This is a synthetic Mac measurement, not device evidence.

Migration: Session version stays 1; only optional derived review metadata is added. Valid old
games retain moves, stories, results, clocks, ratings and receipts; unknown/stale/malformed
review metadata is dropped and annotations recomputed. Existing structurally corrupt saves
remain preserved under prior recovery behaviour. Guest writes and account outboxes store
normalized snapshots; pending terminal flags, order and baseVersion are retained. Server
validation deliberately preserves the exact wire representation for legacy acknowledgements;
modern inbound consumers normalize it. Real disposable API test covers old-client exact echo
and new-client invalidation. Archives contain no evals and retain the existing 200-game bound.
Rollback to old code can read authoritative v1 data but cannot promise neutral-review semantics;
returning to new code discards untrusted derived data again. No data deployment performed.

Reviewer limitations: unchanged custom search is not externally strength-validated, does not
model in-search repetition history, and its internal per-search transposition key retains prior
halfmove/mate-distance limitations. Fresh tables prevent cross-purpose contamination; the
external review identity is stricter. The bounded history fingerprint is not a security proof.
No claim of tournament-complete adjudication or fully verified Milestone A.

Next: A1b bare-king timeout regression/fix, then full Run 1 checks and final report.

### A1a import-check correction

Commit `68b8fff` contains the checked A1a implementation. The newly copied handoff had five
Markdown hard-break trailing-space lines. The final staged whitespace check reported these,
but the command sequence still created the commit; that checkpoint was not fully green.
Corrected the imported document whitespace in a separate follow-up, without rewriting history.
Handoff content/revision is retained; only trailing whitespace is normalized. Full base-to-tree
diff check and staged diff check must pass before this corrective commit. Last fully verified
checkpoint before this correction was `4d4b016`. No code/hook failure was bypassed.

## A1b checkpoint — verified, 11 September 2026 BDT

A1a implementation commit `68b8fff` plus whitespace correction `53cccd0` now pass the full
base-to-working-tree whitespace check; latest verified implementation is `68b8fff` with that
document correction applied. Both independent reviewers approved the complete A1a path.

Bare-king timeout reproduced for both colours (2 expected failures, 8 existing passes).
`settleClock` now draws only if the nonflagging side has no nonking piece. Existing rating
formula applies the draw once, later moves are rejected, and other-material timeout wins
remain unchanged. No multiplayer adjudication changes or retroactive result recalculation.
The first new reason wording exposed takeback in ResultModal; a UI regression reproduced
that failure. Keeping the established `Time out` reason fixes it without a result redesign.

Verified 50 game/storage/modal tests in 5 files, typecheck, lint, format and diff checks; all
exit 0. Both independent reviewers approved. Logs: `/tmp/chess-prodigy-run1/timeout-*.log`.
The first full run passed 247 tests but stopped on indentation formatting after the reason
edit; Prettier corrected it and format:check passed before resuming build/browser checks.

A1 final is in-progress. Added real-browser opponent-score injection and legacy restoration
coverage; it remains uncommitted pending full browser verification. Full run checks pending:
browser, build completion, accessibility and available WebKit journeys. No new feature scope.
Next: finish full boundary checks, record exact outcomes, commit eligible tests/records, stop.

## Run boundary finding and final checkpoint split

A1b commit: `f941d25`. Full canonical checks pass: 247 tests, typecheck, lint, format, build,
52 Chrome desktop/mobile browser passes with four existing deliberate skips, Lighthouse
100/100. Supplemental WebKit: three pass (reload, responsive Classic play, native reviewer),
one FAIL at offline new-page navigation with `WebKit encountered an internal error`.
An untouched base `f2b45b7` archive built in `/tmp/chess-prodigy-run1/baseline-webkit` reproduces
the same exact failed line/error (1 failed). This is an unresolved baseline WebKit check,
not evidence of an A1 regression. Full cross-browser verification is BLOCKED, not green.

Independent browser regression checkpoint: eligible after Chrome full suite, standalone
WebKit reviewer journey, source typecheck and explicit test-file formatting/lint pass.
The initial direct ESLint file command exited 1 because repo config ignores all tests.
Using ESLint API with `overrideConfigFile: true` and `typescript-eslint.configs.recommended`
checked the new browser file: one file, zero errors/warnings, exit 0. No ignore suppression
or repo lint relaxation. Other test files retain the repository existing check scope.

Next: run the standalone WebKit reviewer check, commit that tested regression and truthful
records, export task-only recovery files, report the unresolved baseline check, and stop.

## Final Run 1 report — 11 September 2026 BDT

- A0 verified; A1 reviewer/timeout implementation verified; full canonical suite verified.
- Supplemental cross-browser matrix BLOCKED on baseline WebKit offline navigation.
- Browser regression standalone WebKit check: one pass, exit 0. Earlier WebKit matrix: three
  passed, one failed; baseline reproduction: one failed at the identical navigation step.
- No missing tools for canonical checks. Physical iPhone installation/sound/performance remain
  pending. No claim of physical-device validation or full Milestone A completion.
- Four Chrome skips remain: duplicate mobile account-switch, conflict-stacking and preference
  sync cases; desktop touch-only sound case. No new skips, retries or force-clicks added.
- Synthetic mobile dark screenshot inspected; no layout regression observed. Four generated
  baseline screenshot files restored after keeping task-run copies under the local log folder.
- Main still points at base f2b45b701795ea2aa03e89688ced04b8106b5928. No remote commands,
  deployment, new services, real notification dispatch or live player data access.
- No initial owner changes existed. Remaining task diff before final checkpoint is only the
  native-browser regression and these records. Final checkpoint will commit those exact files.

### Commands and evidence

Run from this persistent checkout after `source ~/.nvm/nvm.sh && nvm use`:

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:browser
# In a separate terminal: npm run preview -- --port 4173 --strictPort
npm run test:accessibility
git diff f2b45b701795ea2aa03e89688ced04b8106b5928 --check
# Focused independence and migration reproduction:
npm test -- tests/engine/reviewer.test.ts tests/game/useGame.test.tsx tests/storage/store.test.ts tests/account/sync.test.ts tests/worker/client.test.ts tests/server/accounts.test.ts
```

Final canonical logs `/tmp/chess-prodigy-run1/full-*.log`: 247 tests/28 files; source checks,
build and browser command exit 0; 52 browser passes/four skips; Lighthouse wood/dark 100.
WebKit command: `npx playwright test --config /tmp/chess-prodigy-run1/playwright-webkit.config.mjs production.spec.js reviewer.spec.ts --grep "reload preserves|Strong search|cached app|native worker"`.
Standalone reviewer command uses the same config and only `reviewer.spec.ts`; exit 0.
Baseline failure uses `/tmp/chess-prodigy-run1/playwright-baseline-webkit.config.mjs`, only
`production.spec.js --grep "cached app"`. Build of untouched base exits 0; test exits 1.
Logs and failure traces remain under `/tmp/chess-prodigy-run1/`; those temporary paths may expire.

### Recovery and exact next task

Persistent owner Mac, not a disposable implementation workspace. Optional recovery export
prepared at `/Users/adnanrashid/Downloads/chess-prodigy-run1-recovery-2026-09-11/`: task-only
Git bundle (requires the recorded base), consolidated binary-capable patch, these two records,
WebKit reproduction configurations and restore instructions. Export/verification runs after
the final local checkpoint; its actual HEAD is written to the recovery README and final reply.
This is owner-accessible local recovery, not an off-device or remote backup.

Stop here. Next bounded development invocation is Run 2: implement default-off capability,
versioned opponent identity/configuration, compatible safe save/resume and explicit unrated-beta
protection before exposing Paul Morphy; then integrate the approved profile with neutral review.
Resolve/characterize the existing WebKit offline-navigation limitation before claiming full
cross-browser/offline acceptance. No rivalry screens, result redesign, Stockfish, iOS packaging
or release operations have begun. Naming clearance, calibration and stronger-review decisions
remain deferred release prerequisites.

### Closeout confirmation

Verified browser/record checkpoint: `557fe3f7207f7ee013da92576f57771151c03ed0`.
Latest application-code checkpoint: `f941d25`; base and main remain `f2b45b7`.
All task changes are committed; initial owner diff and remaining application/test diff are empty.
The recovery directory above now EXISTS and contains the verified task-only bundle, patch,
records, selected synthetic logs and restore README. `git bundle verify` exited 0 and the
consolidated patch passed `git apply --check` against an untouched base source archive.
This documentation closeout is committed separately; export copies are refreshed to include
it, with the actual final HEAD in the recovery README and final owner report.

Run 1 stops here: implementation/canonical checks verified; supplemental WebKit offline check
blocked as reproduced on baseline; physical devices and Run 2 onward deferred.
