# Personality PWA — Run 3 verification

11 September 2026 BDT. Handoff revision 2; plan `docs/plans/2026-09-11-personality-pwa-run3.md`.
Checkout `/Users/adnanrashid/Projects/chess-prodigy`, branch `codex/personality-pwa-run3`,
base `32c023d21229a07f6ab4f88f67f4f73a037b6d97`; initial changes empty.
Both records written before application/test/config/schema changes. No path-convention deviation.

Fresh baseline passed: npm test (285 / 33 files), typecheck, lint, format:check, build,
full browser (74 passed, four existing skips), accessibility (wood/dark 100); all exit 0.
Node 22.23.0. The skips are three duplicate mobile account cases and desktop touch-only audio.
Logs `/tmp/chess-prodigy-run3/`. Prior 285/74 Chrome and ten origin-outage passes are historical,
not newly executed evidence. WebKit offline simulation remains a characterized tool limitation;
physical iPhone installation/sound/performance/lifecycle verification remains pending.

R3.0 complete; R3.1–3 implementation not started. No release or live-data
actions. Next: implement shared archive and guest persistence with failing regressions.

## R3.1 — archive/guest foundation

Implemented shared compact records (optional time metadata), legal replay, 200-game retention,
idempotent upsert/remove and comparable configuration/difficulty rivalry with assistance partitions.
Guest archive key is `chess-prodigy-guest-history-v1`, outside active Session v2. Archive-first writes
reconcile on reopening from the authoritative active save, including interrupted undo. Corrupt,
unknown-version, oversized and quota-blocked history never overwrites existing history bytes.
New-game replacement now stops if the prior terminal cannot be preserved; the result remains in memory.

Red-first module tests and a failing live-hook terminal-handoff regression preceded implementation.
First focused suite passed 108 tests. Independent reviewers found generated archive output could
violate its own bounds, and time validation allowed an array through string coercion. Both reproduced
and fixed: validate before guest/server writes, require primitive time string; metadata limits align
with the existing 256 KiB wire ceiling rather than invalidating formerly valid 257-character IDs.
A legal 501-ply regression preserves the complete active save and prior history while reporting the
500-ply archive limit. This is a recoverable archive failure, not a truncated or silently lost game.

Two additional red-first findings: untimed resignation/abandonment used the previous move timestamp,
and assisted Classic abandonment was omitted. New completions now record actual completion time;
assisted abandonment remains unrated and retains unchanged rating. Historic timestamps are untouched.
Both reviewers approved the fixes; final focused suite **112 tests / 13 files passed**, and
typecheck/lint/format all exit 0 (`r31-final-*.log`). No SQL migration. R3.1 eligible for local commit;
next: account cached history with pending overlay and owner-scoped adapter integration.

## Unfinished R3.2 / R3.3 and scope reconciliation — 11 September 2026 BDT

R3.1 was committed as `14fadb1`. R3.2 adds a separate optional owner-scoped server history
cache, ordered pending overlay, monotonic history responses and conflict handling without
advancing active write versions. Missing cache is honestly incomplete offline; corrupt optional
history bytes remain preserved while the valid active save and queue continue working.
No SQL migration or snapshot-wire change. Pending undo is applied before trimming to 200.

Red-first account tests preceded implementation. A same-timestamp fixture had incorrect order
expectations and was corrected with a distinct completion time. A cleanup-ref lint warning was
fixed using a stable invalidation callback. Final focused check: 119 tests / 14 files pass;
`r32-final-tests-rerun.log`, `r32-final-lint.log`, `r32-final-typecheck.log`, and
`r32-final-format.log` record exit 0. Both independent reviews report no actionable findings.
R3.2 remains uncommitted; R3.3 only has `tests/ui/RecordedGames.test.tsx`, whose missing-component
failure is recorded in `r33-red.log`. No Games component/result/rematch UI has been implemented.

Fresh full suite during resumption exits 1: 302 passed, one App timing assertion failed;
35 files passed, two failed (including the missing-component suite). Full log:
`/tmp/chess-prodigy-scope-check-2026-09-11/full-tests.log`. Current tree is NOT fully verified.
The explicit Run 1-only instruction conflicts with the saved Run 3 continuation interpretation;
no further application changes or later code commits until scope is resolved. Preserve the
four modified source files and two untracked tests; documentation-only preservation is separate.

Isolated `npx vitest run tests/ui/App.test.tsx` rerun: eight pass, exit 0. Timing sensitivity
remains unresolved; no full-suite success claim. Recovery export directory:
`/Users/adnanrashid/Downloads/chess-prodigy-preserved-20260911-Y0P4bw/` (task-only bundle,
unfinished patch/new tests, records/logs; verify against documentation checkpoint HEAD).

## Explicit Run 3 resumption — 11 September 2026 BDT

Owner “go for run 3” resolves the scope pause. Resume at documentation HEAD `0698540`,
with four modified sources and two new tests preserved. No additional application changes
preceded this record update. Existing full baseline results and dirty-tree failures remain
accurate historical evidence. Next: checkpoint reviewed account history, implement UI and
resolve full-suite timing sensitivity; final full verification remains pending.

R3.2 checkpoint reverified after scope confirmation: `npm test -- tests/game tests/storage
tests/account tests/server/accounts.test.ts` passes 119 tests / 14 files. Fresh typecheck and
lint exit 0 before UI integration edits. The global format check failed on the concurrent
R3.3 component/test under construction; canonical format must pass before committing. Source/test diff
inspected; both independent reviews complete. Stage only four R3.2 sources, account-history
test and these records. R3.3 unfinished UI tests are excluded from this scoped commit, remain
tracked in the record, and must pass the full suite before the run is called verified.

App timing diagnosis: production deliberately enforces a 1000 ms minimum reply delay, while
its existing App test used the default 1000 ms polling deadline. Replace that racing wait with
controlled timers, asserting no reply at 999 ms and the reply at 1000 ms. No application timing
change. Completion UI red tests now fail on missing rivalry/Rematch/Games, after correcting an
initial fixture that used an unsupported clock control to the existing 15 | 10 control.

Canonical format rerun after UI files stabilized exits 0 (`r32-resume-format-final.log`);
R3.2 declared checks now pass, including earlier fresh 119-test/typecheck/lint checks.
Concurrent UI production build also passes (`r33-build.log`), but its browser checkpoint
remains pending. Commit only the reviewed R3.2 sources/account test and execution records.
