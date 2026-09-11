# Personality PWA — Run 1 implementation record

Date: 11 September 2026 BDT. Scope: revision 2 of the owner's supplied
`/Users/adnanrashid/Downloads/CHESS_PRODIGY_BUILD_HANDOFF_v2.md` (read and confirmed).
Execute A0 + A1 only. Product/naming decisions are settled; no personality UI in this run.

## Starting state

- Persistent owner Mac checkout: `/Users/adnanrashid/Projects/chess-prodigy`.
- Base: `f2b45b701795ea2aa03e89688ced04b8106b5928`; initially `main`, clean index/worktree,
  no pre-existing staged, unstaged or untracked changes.
- Actual feature branch: `codex/personality-pwa-run1`, same checkout, no separate worktree.
- Node 22.23.0, npm 10.9.8, existing locked dependencies. No install needed initially.
- Requested record paths used; historical `docs/superpowers/plans` is not a required override.
- No remote push, PR, merge, deploy, publication, live records, new services or A2 work.
- No runner time/turn budget supplied. Reserve verification and checkpoint reporting capacity.

## Design and checkpoint checks

Use a replaceable neutral-review interface over the existing evaluator, with explicit
purpose/version/search policy/completed depth and board/rule/history identity. Only validated
neutral results enter review caches. Opponent results remain move decisions. Invalidate legacy
derived scores and recompute dependent annotations; preserve all authoritative saved data.
Use comparable settings for before/after verdicts and show incomplete review honestly.

1. **A0 — in-progress:** inspect governance, product, handoff and data path; create records;
   run baseline typecheck, lint, format, unit/server tests, build, browser, accessibility and
   diff checks. Documentation-only commit after scope/diff inspection.
2. **A1a — not-started:** write failing tests for neutral identity/settings, worker separation,
   legacy cache migration and annotation replacement. Implement evaluator/worker/cache/restore
   boundary through `src/engine`, `src/worker`, `src/coach`, `src/game`, `src/storage` and affected
   account paths. Check focused engine/coach/game/storage/worker/account tests, typecheck,
   lint, formatting and diff; review and locally commit.
3. **A1b — not-started:** reproduce bare-king timeout; fix only the proven computer-practice
   case. Check clock/rating/storage regressions, typecheck and diff; locally commit if green.
4. **A1 final — not-started:** complete four required independence checks, independent review
   of evaluator → worker → live/persisted caches → legacy restoration → annotation recomputation.
   Run existing full checks including browser/accessibility; record limitations and local commits.
5. **A2 / Runs 2–3 — deferred:** no Morphy, rating-label redesign, rivalry, iOS or release work.

## Required independence evidence

- Identical board/history and deterministic reviewer settings ignore test personality IDs/weights.
- Test-only biased evaluator picks a demonstrably inferior move; neutral review detects the
  documented loss threshold. No production mistake-making personality.
- Opponent work, worker reuse, saved caches and restoration never qualify as neutral analysis.
- Reanalysis replaces an earlier annotation; cancelled/stale results cannot mutate current play.

## Recovery and next action

Local commits are checkpoints in a persistent owner-accessible checkout, not remote backups.
No disposable environment is in use; no external export is required. Records and task-only
commits remain locally accessible. No blockers currently; baseline checks pending.
Next: run baseline checks and record actual outcomes before any application/test/config/schema edit.

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
