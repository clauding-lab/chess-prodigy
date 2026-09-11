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
