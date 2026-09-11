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

## Progress checkpoint

Baseline/diagnosis committed as `4ca52bc`. Supplemental regression implemented; final focused
suite passed ten checks across Chrome/WebKit. Both reviewers approved after removing automatic
fixture reseeding and making server cleanup unconditional. No application change needed.
Final 285-test suite, source checks and explicit new-file checks pass; expanded canonical browser
passed 74 checks with four existing skips, and Lighthouse scored 100 in both themes. A WebKit
explicit-update check also passed. Next: commit eligible test/README/records,
export task-only recovery and stop. Device airplane mode, installed-app lifecycle and physical
iPhone checks remain pending, as does the unchanged emulated-offline WebKit limitation.

## Closeout — 11 September 2026 BDT

Investigation complete; no app fix justified. Local checkpoints: `4ca52bc` baseline/diagnosis,
`f6883f1` reviewed regression and final full checks. A documentation-only closeout follows.
All task files committed; no unrelated work, identity changes, skipped hooks or history rewrite.
Main remains `f2b45b7`; no push, PR, deployment, publication or live player access.

Task-only recovery: `/Users/adnanrashid/Downloads/chess-prodigy-webkit-recovery-2026-09-11/`.
Bundle verified; binary patch checked against an untouched archive of base `9460b1c`.
Both records, check logs, diagnostic scripts and synthetic evidence are copied there. Artifacts
are refreshed after the closing documentation commit; external README records the exact final
HEAD. Persistent owner-Mac recovery is not off-device backup. No migration behaviour changed.

Next exact development task, on a separately invoked Run 3: inspect handoff revision 2 remaining
A4 and existing archive paths, write Run 3 records, then add bounded guest archive/legal replay
and private per-profile/per-difficulty rivalry records before remaining A5 result/rematch work.
Physical iPhone Safari/installed-app airplane-mode reopening and background/lifecycle checks
remain a separate acceptance requirement. Do not repeat the unchanged WebKit emulation failure
as an app-fix task unless the tool version changes or new contrary evidence appears. Stop here.
