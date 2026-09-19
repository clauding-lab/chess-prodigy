# Chigorin integration record — 13 September 2026 BDT

Status: locally verified on 19 September 2026 BDT. No Chigorin deployment or publication has occurred.
Base main35513d7; branch codex/chigorin, isolated .worktrees/chigorin.
Approved design: ../../superpowers/specs/2026-09-12-chigorin-design.md.

## Rated activation — 19 September 2026 BDT

The completed 400-game frozen measurement was independently accepted at Casual 1250 / Club 1350 /
Strong 1625. Commit 37258dc activates only exact supported Chigorin version 1; the sole engine-source
difference from frozen adfc006 is rated eligibility. All old playing policies/books remain exact.
See [measurement](measurement-report.md) and [independent audit](independent-calibration-review.md).

Full unit/integration verification passed 471 tests in 54 files with four workers. Earlier attempts
exposed a Vitest reporting timeout caused by the roughly 78-second synchronous corpus replay;
moving its unchanged assertions into an asynchronously awaited child fixed it. A 110-second child
deadline now terminates slow runs inside the 120-second test limit; focused replay passed after cleanup.
No corpus, parser or playing policy was altered to pass the tests.

The full enabled browser run passed 138 checks with 4 intentional skips; two stale Home-dropdown
assertions failed and were corrected to the approved visible Wikipedia link. The complete Home
spec then passed 4/4 on desktop/mobile, including both-theme accessibility and overflow checks.
Focused Chigorin browser verification passed 20 checks covering all levels/colors, rating receipts,
forfeit/replay/rematch, disposable accounts and real offline worker/review use.

Typecheck, lint, formatting and both enabled/default builds pass. Enabled Lighthouse accessibility
is 100 in Wooden and Dark. Parent visually inspected the actual three-card Home screenshot; retained
desktop/mobile screenshots are under [screenshots](screenshots/). Mobile emulation is not physical-device
evidence. The default browser matrix passed 122 checks with 22 intentional skips, covering the
default-off selection boundary and all applicable existing flows.

Whole-branch TypeScript/security/spec review approved the source. Its only final finding concerned
corpus child cleanup; commit 91b0a10 resolved it and scoped re-review approved. No outstanding production
review finding. Current main deployment-maintenance changes were merged in 90f4178 and preserved.

No source push, deployment or live player data access occurred in this continuation. The separate
Spassky/Tal/Fischer work uses the approved 19 September roster design and a different working folder.

Command logs retained for this continuation:

- `/tmp/chigorin-final-unit-fixed-20260919.log` — 471 tests / 54 files, exit 0.
- `/tmp/chigorin-final-browser-enabled-20260919.log` — 138 passed, 4 skipped, two stale test failures.
- `/tmp/chigorin-final-home-20260919.log` — corrected complete Home spec, 4 passed, exit 0.
- `/tmp/chigorin-default-browser-20260919.log` — 122 passed, 22 skipped, exit 0.
- `/tmp/chigorin-accessibility-20260919.log` — Wooden 100 / Dark 100, exit 0.

Temporary logs are supplementary; this record, retained measurements, review reports and screenshots
are the durable evidence. The enabled build worker remains 2,490,030 bytes, below the 3 MiB per-file
offline cache ceiling. Benchmark source and all older playing policies remain unchanged.

## Completed foundations

Baseline426 tests/46 files pass. Engine taskb523790 has44 focused passing tests and preserved source
and behavior evidence in this directory. Calibration protocol chigorin-plans-paired-v1 adds exact
opponent identity and engine/book/key fingerprints;22 calibration tests pass including old protocols.
New state-v6/account-v6/history-v5 preserve every older recovery generation and pending ordering.
Permanent account capability4 after accepted Chigorin, including assisted games, survives reset and
server restart.92 storage/account/server tests pass; raw legacy wire acknowledgement remains exact.
Independent foundations review found no actionable issues; engine review and measurement remain gates.

## Requested header adjustment

Saved to account now follows navigation controls on a centered full-width second row. The original
status text/role and synchronization behavior are preserved. Local signed-in Playwright Chrome at
390x844 and1280x1000 verifies computed center alignment, status top104 vs links bottom98 and no
horizontal overflow. Disposable local account only; no live player records accessed. Screenshots
are retained alongside this record. This is browser emulation, not physical-phone evidence.

## Offline build

Initial worker3.51MB exceeded the default2MiB precache ceiling. Lossless reversible FEN-board plus
canonical legal-position suffix encoding reduced it to2,490,030bytes with all counts preserved.
An explicit3MiB file ceiling admits the complete engine; enabled build succeeds with15 precache
entries. Actual offline Chigorin game/reload verification remains part of final integration checks.
