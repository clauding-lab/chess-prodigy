# Chigorin integration record — 13 September 2026 BDT

Status: local development in progress. No Chigorin deployment or publication has occurred.
Base main35513d7; branch codex/chigorin, isolated .worktrees/chigorin.
Approved design: ../../superpowers/specs/2026-09-12-chigorin-design.md.

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
