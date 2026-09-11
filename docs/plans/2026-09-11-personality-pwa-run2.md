# Personality PWA — Run 2 execution plan

11 September 2026 BDT. The owner's “go on” invokes the next bounded Run 2 in
revision 2 of `CHESS_PRODIGY_BUILD_HANDOFF.md`. Run 1 is retained in its original records.

## Actual starting state

- Persistent Mac checkout: `/Users/adnanrashid/Projects/chess-prodigy`.
- Base: `8a5a472f7301b4794d3f6a99ab2c03a4b749c0a1`; original milestone base `f2b45b7`.
- Dedicated continuation branch: `codex/personality-pwa-run2`; no separate worktree.
- Initial staged/unstaged/untracked diff: empty. Run 1 commits remain intact.
- Node 22.23.0 / npm 10.9.8; existing locked dependencies. No runtime budget supplied.
- No push, PR, merge, deployment, publication, paid services or live player data.
- Baseline supplemental WebKit offline navigation is already reproduced as failing on
  pre-Run-1 source; it remains a separate unresolved verification limitation.

## Approved design and checkpoints

Use the existing engine, UI and account store. Add a serializable, versioned opponent
configuration with a stable `attack-development` ID and a display registry for Paul Morphy.
Keep the reviewer fixed and independent. Style rewards remain bounded and material values
unchanged. Difficulty stays separate, with existing Classic budgets and behaviour preserved.

1. **R2.0 — passed:** record baseline, run source/unit/build/browser checks, commit
   this plan after diff inspection. Carry forward the measured WebKit limitation explicitly.
2. **R2.1 — not-started:** safe identity/persistence/rating foundation and default-off flag.
   Version-2 authoritative saves, deterministic Classic migration, isolated new local keys,
   versioned account outbox migration and server downgrade protection. Preserve exact legacy
   acknowledgements, account ownership, archive idempotence and rating receipts. Unsupported
   saved opponent versions retain a read-only/recovery path. All beta outcomes remain unrated;
   assistance is recorded separately. No selectable beta before R2.2/R2.3 are complete.
   Checks: red-first game/storage/account/server regressions, typecheck, lint, formatting, diff.
3. **R2.2 — not-started:** versioned Morphy evaluator and seeded per-ply worker/book selection.
   Explicit evaluator context, fresh search tables, bounded development/open-line/king-pressure
   preferences, safety/forced-move/deadline fixtures and held-out/complete-game smoke tests.
   Re-run all reviewer independence tests with actual opponent configurations. Checks: focused
   engine/worker/reviewer suites plus source checks; independent code/TypeScript review.
4. **R2.3 — not-started:** minimal selection/resume UI behind `VITE_PERSONALITY_BETA=true`.
   Classic remains available; both colours/flip show the correct full opponent name and level.
   Practice Rating wording explains the internal measure; beta status never claims hints caused
   its exclusion. Flag off hides new selection but retains supported saved beta games safely.
   Checks: UI regressions, disabled/enabled browser journeys, account/archive save+restore,
   offline worker play, keyboard/focus/narrow layout, source checks and independent review.
5. **R2 final — not-started:** full canonical suite and accessibility, relevant WebKit journeys,
   honest blocker report, local checkpoint commits and owner-accessible recovery export.

Run 3 rivalry/archive replay screens, result redesign and enhanced rematch are deferred.
No Stockfish, iOS packaging, external analytics, new stories or additional roster profiles.

## Compatibility strategy

Version-2 guest/account keys isolate modern state from stale version-1 browser writers.
Read and migrate existing version-1 originals only when no new authoritative key exists;
do not erase originals or silently fall back from a corrupt new save. Preserve outbox order,
terminal markers and baseVersion. Server rejects downgraded writes after accepting version 2.
Legacy wire snapshots still receive exact acknowledgements while modern consumers migrate.
Unknown opponent configuration must not silently become Classic. Version/seed metadata and
explicit unrated reason travel with active games and existing private account archives.
Retain the archive's 200-game bound; do not add a guest rivalry archive in this run.

## Next action and preservation

Baseline commands passed and recorded before application/test/config edits.
Next: implement R2.1 with failing migration, downgrade and beta-rating tests first.
Update both Run 2 records at every checkpoint. Keep all commits local
and stage explicit task-owned paths only. Export a task-only bundle/patch and both records to
Downloads at closeout; this persistent local copy is not an off-device backup.
