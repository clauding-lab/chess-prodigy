# WebKit offline investigation

11 September 2026 BDT. Owner continuation: investigate the retained baseline/current WebKit
offline navigation failure. Run 3 feature work remains deferred.

- Checkout: `/Users/adnanrashid/Projects/chess-prodigy` (persistent owner Mac).
- Branch: `codex/webkit-offline-investigation`; no separate worktree.
- Base: `9460b1c1a15924d17428a78e634d9a91f8a9c100`; pre-existing changes: none.
- Original comparison baseline: `f2b45b701795ea2aa03e89688ced04b8106b5928`.
- Records follow existing `docs/plans` and `docs/verification` convention.
- No release, remote writes, live player data or forced active-game update.

Checkpoints:
1. Record starting state, run baseline canonical checks and reproduce WebKit offline error.
2. Trace service-worker installation/control/cache and browser network emulation on current
   and original baseline; compare a minimal independent offline page if needed.
3. Fix only an evidenced application/test defect with a failing behavioural reproduction;
   independent review and relevant/full checks before claiming verification. If the cause is
   external, retain reproducible evidence and accurate limitations without speculative fixes.
4. Commit eligible task-only changes locally, export/verify recovery to Downloads, stop.

Required checks: Node >=22.19; npm test, typecheck, lint, format:check, build, canonical browser
suite and accessibility. Supplemental WebKit original/current offline and online controls.
Preserve explicit PWA updates, Classic/Morphy saves, neutral review and account isolation.
Physical iPhone evidence cannot be supplied by browser emulation. No tool blocker identified yet.

Baseline canonical checks passed; minimal and original/current comparisons identify the
installed WebKit offline-emulation boundary. No application change justified. Next: add a
supplemental server-unavailable regression, keep existing emulation checks intact, independently
review the test and run canonical/full plus focused cross-browser checks before closeout.
