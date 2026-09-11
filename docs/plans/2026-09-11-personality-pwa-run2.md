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
2. **R2.1 — implemented/checked:** safe identity/persistence/rating foundation and default-off flag.
   Version-2 authoritative saves, deterministic Classic migration, isolated new local keys,
   versioned account outbox migration and server downgrade protection. Preserve exact legacy
   acknowledgements, account ownership, archive idempotence and rating receipts. Unsupported
   saved opponent versions retain a read-only/recovery path. All beta outcomes remain unrated;
   assistance is recorded separately. No selectable beta before R2.2/R2.3 are complete.
   Checks: red-first game/storage/account/server regressions, typecheck, lint, formatting, diff.
3. **R2.2 — implemented/checked:** versioned Morphy evaluator and seeded per-ply worker/book selection.
   Explicit evaluator context, fresh search tables, bounded development/open-line/king-pressure
   preferences, safety/forced-move/deadline fixtures and held-out/complete-game smoke tests.
   Re-run all reviewer independence tests with actual opponent configurations. Checks: focused
   engine/worker/reviewer suites plus source checks; independent code/TypeScript review.
4. **R2.3 — implemented; canonical checks passed:** minimal selection/resume UI behind `VITE_PERSONALITY_BETA=true`.
   Classic remains available; both colours/flip show the correct full opponent name and level.
   Practice Rating wording explains the internal measure; beta status never claims hints caused
   its exclusion. Flag off hides new selection but retains supported saved beta games safely.
   Checks: UI regressions, disabled/enabled browser journeys, account/archive save+restore,
   offline worker play, keyboard/focus/narrow layout, source checks and independent review.
5. **R2 final — checks complete; preservation in progress:** full canonical suite and accessibility, relevant WebKit journeys,
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
Next: commit the checked UI checkpoint, verify recovery export, stop before Run 3.
Update both Run 2 records at every checkpoint. Keep all commits local
and stage explicit task-owned paths only. Export a task-only bundle/patch and both records to
Downloads at closeout; this persistent local copy is not an off-device backup.

## R2.1 decisions and checkpoint

Schema v2 records opponent ID/version, engine version, random policy/seed, explicit unrated
reason and takeback usage (nullable when legacy history cannot prove assistance). Difficulty
stays in setup. Version 1 migrates to Classic deterministically; modern parser output is
idempotent. Guest key is `chess-prodigy-state-v2`; account key is
`chess-prodigy-account-v2:<encoded-user-id>`. Read the corresponding v1 original only when
the new key is absent. Preserve originals; write migrated account queues before sending.

The server validates both schemas, stores/acknowledges the original wire, and uses a normalized
v2 projection for archive metadata. Its atomic write transaction rejects schema downgrade
with HTTP 426 even when the caller has the latest write counter. Rollback to a v1-only client
or server cannot provide working v2 sync; retain/export v2 data and use compatible code.
No deployment or database rewrite is part of this run.

Unavailable configuration is read-only at reducers, clock/rating settlement and hook workers;
new game and rating reset are blocked too, avoiding silent replacement. UI explanation/recovery
download follows in R2.3. Review data is still normalized in memory; original guest bytes stay
unchanged. Beta resignation, timeout and abandonment archive without rating. Undo removes the
receipt/terminal record as before and records assistance without replacing the beta reason.

Independent code/data-path and TypeScript reviews completed. One data-path finding (unavailable
opponent retaining stale review annotations) was reproduced in a new failing regression, fixed
and checked. No beta selection is exposed at this foundation checkpoint; worker style support
is the next dependency.

## R2.2 decisions and checkpoint

`attack-development` v1 uses `style-v1` and `seeded-per-ply-v1`. The persisted uint32 seed,
full position and ply produce request-local opening randomness, so reload/retry/undo has no
hidden mutable RNG to lose. Actual search depth still depends on wall-clock availability.
Worker AI requests require config and ply; analysis requests carry no opponent evaluator.
Search has an explicit private evaluator with a fresh table per request. Classic dispatch and
all default neutral evaluation calls retain the existing policy and material values.

White-perspective style adds at most ±80 centipawns (0.8 pawn). A developed minor piece gets
8; usable bishop diagonal reach adds at most 12; a rook with at least three clear forward
squares and no own pawn gets 6 for a semi-open file or 12 for an open file. Enemy king-ring
pressure gives 4 per attacked square (at most five), plus 12 for check. Development/check/
king pressure fade linearly as total non-pawn material falls from 6400 to 2600; useful lines
remain relevant in endings. No raw capture reward or material discount is introduced.

Existing legal opening continuations are weighted by the same bounded style signal. Immediate
mate outranks book choices. That pass, book work and search share the difficulty deadline;
Classic budgets are unchanged. Forced positions need not differ. In an Italian opening fixture
after `e4 e5 Nf3 Nc6 Bc4 Nf6 d3`, out-of-book Club Morphy develops `Bc5` versus Classic `Bd6`.
Tests include defended targets, adverse material, neutral validation of winning simplification,
both colours, mate/only legal choice, deadline accounting and three complete initial-board games.
They are execution/safety evidence, not historical fidelity or calibration. No beta UI yet.

## R2.3 decisions and checkpoint

New setup selection and the hook's start boundary both require exactly
`VITE_PERSONALITY_BETA=true`; ordinary builds hide Morphy. Difficulty is independent and
the full name follows the opponent colour under board flipping. Existing supported Morphy
saves resume immediately with the flag off, including before the first move. New games
generate a fresh seed while keeping the chosen profile/version and difficulty explicit.
No biographies, extra profiles, rivalry UI or result redesign were added.

Practice Rating wording now explains performance within this app. Beta status states
“Unrated beta — opponent calibration pending.” Resignation no longer promises a rating
adjustment for unrated games; legacy/reset/hint/takeback reasons are distinct. Existing private
archive rows now include opponent names. The underlying rating calculation is unchanged.

Unsupported configurations disable gameplay/replacement/reset/review and explain the read-only
state. Recovery downloads contain the full normalized session, without changing stored bytes.
An explicit app update can proceed after recovery export; it cannot automatically reload a game.
There is no recovery-file import UI in this run. Mixed v1 snapshots carrying newer opponent
fields are preserved as unreadable rather than silently relabelled Classic; a red-first regression
and independent migration/server review confirm genuine v1 saves still migrate.

Native Chrome journeys passed with the flag off and on, including offline reply/review,
both colours/flip, actual recovery-file contents and account terminal archive preservation.
Expanded wood setup accessibility exposed 3.77:1 contrast on existing option labels; raising
their opacity from .6 to .75 fixed the check. Dark and wood setup axe checks now pass. Final
canonical suite passed: 285 unit/UI/server tests, typecheck/lint/format/build, 64 Chrome checks
(four existing skips), Lighthouse 100 in both themes. The enabled beta subset passed 10 checks.
Stale browser assertions and the accessibility script's v1 key were corrected after their recorded
failures; full browser and accessibility reruns passed. Supplemental WebKit offline reload remains
blocked by an internal navigation error; selection, actual recovery downloads and both final online
reviewer checks passed. Physical iPhone evidence remains pending; no full milestone claim.
