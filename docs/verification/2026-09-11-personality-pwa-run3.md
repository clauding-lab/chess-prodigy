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

## R3.3 implementation and browser checkpoint — in progress

R3.2 committed `7839444`. Added Games within the existing practice controls, legal read-only
replay, version/difficulty W/D/L partitions, original-history download and honest cache status.
Results retain outcome/rating precedence and add Rematch/Review/New game. Rematch opens existing
setup, retains colour/clock/profile/difficulty and creates a fresh ID/seed on start. Missing
historical clock is explicitly No clock; beta-disabled rematches never substitute Classic.
Failed terminal preservation remains in setup with a recovery-save download. Opening Games
continues active clocks. No archived neutral annotations or causal narratives are invented.

Component's 12 tests and completion's 5 tests pass. The full suite passed 320 tests / 38 files
before review identified coercible archive enums: arrays passed `String(...)` validation and
could count a displayed draw as a loss. Red-first regression failed as expected; require primitive
result/level/colour strings. Follow-up focused 110 tests / 19 files, typecheck/lint/format pass.
Independent whole-path code/TypeScript review approves the fix and final UI with no remaining
findings. Supplemental strict new-test TypeScript exposed unsupported Testing Library `exact`
options copied from old tests; removed them (role string names are exact by default).

New browser file `tests/browser/records.spec.ts`: seven desktop and seven mobile passes on a
normal default-off build. Tests cover actual guest completion/archive/replay, both-colour Classic
rematches, flag-off Morphy, 320px wood/dark keyboard/focus and axe, offline reload/replay, and
real disposable account archive ownership (including wrong-owner HTTP 401). No live data.
Browser file strict types/format pass. Enabled-beta branch and full canonical/browser matrix
still pending. Extend the existing origin-outage test through resignation, reload and history
replay for both profiles/colours in Chrome/WebKit; this is stronger offline archive evidence.

### Broader verification and test-harness corrections

Final application suite: **321 tests / 38 files pass**, typecheck/lint/format all exit 0
(`final-tests.log`, `final-typecheck.log`, `final-lint.log`, `final-format.log`). Enabled-beta
build passes and 24 desktop/mobile personality+records browser checks pass (53.2 s).
320px wood/dark replay screenshots were visually inspected: readable controls and clear keyboard
focus, no horizontal clipping. Physical-device claims remain pending.

The extended Chrome/WebKit origin-outage suite initially passed nine cases but failed one
at browser-context teardown with ENOENT for a trace file: the concurrent normal browser runner
cleared the shared parent `test-results` directory. Reran with distinct absolute output directory
`/tmp/chess-prodigy-run3/offline-origin-traces`: **10/10 pass**, 30.6 s. Assertions were not removed,
retries/skips were not added, and no application offline workaround was introduced.

Independent test review found the new browser helper could reseed deleted local keys on reload,
masking a persistence failure. Replace it with one-time blank-origin setup before mounting;
then rerun both default-off record projects and enabled-beta rematch branch. This is a test
strengthening requirement, not a proven application data-loss defect. The origin-outage test
already seeds once and independently proves completion/archive/replay after origin shutdown.
A supplemental browser TypeScript command initially omitted installed Node typings; rerun with
`--types node,vite/client,vite-plugin-pwa/client`. No tool/dependency install or check relaxation.

## Milestone A acceptance map

| Area | Automated evidence in this run | Remaining limit |
| --- | --- | --- |
| Existing play | Full engine/game/UI tests, Classic both-colour browser play, clocks/promotion/catch-up, controlled minimum reply delay | Physical-device performance pending |
| Independent review | All four A1 regression groups rerun in full 321-test suite; native reviewer browser journey | Current custom reviewer is not externally strength-validated |
| Morphy behaviour | Existing style/search/worker fixtures and both-colour native beta journeys rerun | Calibration and historical fidelity not claimed |
| Persistence | Legacy/unknown/corrupt save and queue tests; guest history corruption/quota/retry; compatible beta reload | No recovery-file import interface |
| Rivalry | Legal replay, 200-bound retention, assistance/configuration/difficulty partitioning, undo/recompletion; guest/account browser records | Retained counts are not lifetime/person-level analytics |
| Rating | Classic receipt and migration regressions, unrated beta, both-colour rematch keeps rating | No changed formula or strength calibration |
| Account isolation | Account sync history/conflict/cache tests and disposable real API/browser owner boundaries | No live player records accessed |
| Worker lifecycle | Existing cancel/restart/unmount/review replacement regressions rerun | Physical OS process eviction not tested |
| Multiplayer | Full server/chat/notification tests and canonical invitation/H2H browser journeys | No real email/push delivery attempted |
| PWA | Ten origin-outage Chrome/WebKit play/review/completion/reload/replay checks, blocked-SW negative controls; canonical offline/update tests | WebKit simulated-offline limitation remains; no airplane-mode/device claim |
| UI | 320px dark/wood axe, keyboard/focus replay, existing reduced-motion tests, Lighthouse 100/100 | Phone installation/sound/performance pending |
| Failure handling | Guest quota/corruption recovery, unknown versions, offline account cache/queue/conflicts, feature-off rematch | Recoverable failures may require retaining exports for assisted restoration |

This table maps requirements to tests, not a claim of measured user retention or release readiness.
Final canonical browser count, additional WebKit UI result and checkpoint eligibility follow below.

## Final compatibility and rollback behaviour

No SQL schema migration. Active Session/schema/key version 2 and server snapshot wire remain
unchanged from Run 2. GameRecord v2 adds optional clock metadata; old records omit it, and missing
personality remains Classic. Preserve existing clocks, moves, stories, receipts and old keys.
Derived review metadata still follows A1 normalization; archives contain move replay, not analysis.

Guest history key `chess-prodigy-guest-history-v1` retains at most 200 unique IDs and at most 500
moves per compact record. A legal longer active game is preserved completely for recovery; it
cannot be silently truncated into the archive. Archive corruption/size/quota failure never resets
history, and failed terminal preservation blocks starting a replacement game. Interrupted undo
is reconciled from the active save on opening. No automatic guest import on account entry.

Account cached history lives outside active snapshots and pending items. Missing cache can be
refetched; offline absence is labelled incomplete. Ordered pending terminal/undo transitions overlay
the server archive and remain queued until acknowledged; keep existing version conflict choices.
Corrupt optional cache data stays exportable without invalidating a valid active save/outbox.
Disposed ownership and older responses cannot replace the current account's records.

Rolling back to Run 2 keeps v2 active saves and server records readable but may discard optional
account cache fields; server history can be refetched with Run 3. Older code does not maintain the
new guest archive, so do not rely on it to archive newly completed guest games. Preserve all keys
and recovery exports and restore compatible code. A v1-only rollback remains blocked from writing
v2 account snapshots by the existing HTTP 426 protection. No rollback or deployment was performed.

## R3.3 verified checkpoint — 11 September 2026 BDT

- Full canonical browser: **88 passed, four existing skips**, exit 0 (4.4 min), `final-browser.log`.
  Skips remain three duplicate mobile account cases and the desktop touch-only sound case.
- After the test-only seed correction, **14/14** record journeys pass (`final-records-one-time-seed.log`).
  An isolated probe using the actual helper confirms deleted keys stay missing after navigation/
  reload (`one-time-seed-probe.log`). Independent review approves the correction; no open findings.
  No application changes followed the full canonical suite, so the test-only correction received
  its focused rerun rather than repeating unchanged unrelated browser journeys.
- Final supplemental WebKit UI/account/update: **7/7 passed**, 13.6 s (`final-webkit-ui.log`).
  Command: `npx playwright test --config /tmp/chess-prodigy-run3/playwright-webkit-run3.config.mjs
  --grep-invert 'Chrome offline'`. The excluded Chrome-labelled simulation case is already checked
  in Chrome; WebKit offline uses the separately passing ten-case stopped-origin matrix.
- Beta-on after seeding correction: **2/2** archived Morphy rematches pass on desktop/mobile,
  including retained configuration/new seed (`final-beta-rematch-recheck.log`); earlier combined
  personality/records beta run **24/24** passed. Do not add overlapping counts as unique cases.
- Full source checks and 321 tests pass; Lighthouse **wood 100, dark 100** (`final-accessibility.log`).
  Explicit strict new UI/account and browser test types pass. Direct ESLint checked five changed/
  new test files with zero errors/warnings; explicit browser formatting passes.
- Final ordinary production build restores default-off beta (`final-default-build-restored.log`).
  Earlier beta builds are test artifacts only. No persistent frontend environment flag was changed.
- Four canonical tracked PNGs generated by tests were copied under `generated-baseline-screenshots`
  then restored to their committed content. New 320px screenshots remain synthetic temporary
  evidence; selected copies accompany recovery. No unrelated owner changes were discarded.

R3.3 source/tests/documentation are eligible for an explicit local Conventional Commit after
staged scope/whitespace inspection. Latest verified prior code checkpoint is `7839444`.
All six pre-existing unfinished task files from resumption are accounted for in R3.2/R3.3;
there were no unrelated staged files. No database migration, live data or release operation.
