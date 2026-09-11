# Personality PWA — Run 1 verification

11 September 2026 BDT. Owner handoff revision 2 confirmed. This is local Run 1 evidence,
not a release claim. Plan: `docs/plans/2026-09-11-personality-pwa.md`.

## Environment and preservation

Persistent Mac checkout `/Users/adnanrashid/Projects/chess-prodigy`;
branch `codex/personality-pwa-run1`; base `f2b45b701795ea2aa03e89688ced04b8106b5928`.
Initial index/worktree clean; no unrelated changes. Node 22.23.0 / npm 10.9.8.
Tests must use synthetic guests/disposable databases; no production data or notification dispatch.

## Baseline — pending

All commands below are pending, not historical passes:

| Check | Result |
| --- | --- |
| `npm run typecheck` | pending |
| `npm run lint` | pending |
| `npm run format:check` | pending |
| `npm test` | pending |
| `npm run build` | pending |
| `npm run test:browser` | pending |
| `npm run test:accessibility` (isolated preview 4173) | pending |
| `git diff --check` | pending |

## Checkpoints

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
