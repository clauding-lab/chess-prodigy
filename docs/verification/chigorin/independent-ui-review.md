# Task 3 independent UI/game integration review

13 September 2026 BDT.

## Scope and verdict

Reviewed exact local commit `dc08be54c8e7bec3adb3d6fb6e9f348d59cd2c02`, diff
`cc916cf..dc08be5`, against the approved Chigorin design and implementation plan,
with `task3-report.md` and surrounding opponent/game/archive behavior. Staged and
unstaged source diffs were empty at review start. This is a local checkpoint review;
PR merge readiness/remote CI was not available or assessed.

**SPEC: PASS for the explicitly bounded premeasurement checkpoint.**
**QUALITY: PASS. No actionable correctness, type-safety, security or regression
findings in the scoped change.** This is not acceptance of the completed rated
Task 3 or permission to publish/deploy.

## Findings and reasoning

- `CHIGORIN_RATINGS = null` consistently disables Home selection, setup selection,
  Start for a Chigorin draft, and both result/history rematches. `setupFromDraft`
  independently rejects pending measurement, a disabled personality flag and
  unsupported Chigorin versions. It cannot silently turn a supported Chigorin
  draft into Classic.
- `canRematch` first checks the complete supported configuration. App carries the
  original opponent id/version into the draft; setup constructs Chigorin version 1
  with its exact engine/random policy and a valid new per-game seed. Existing
  Morphy versions 1–4 retain their prior constructor paths, ratings and legacy
  rematch explanation. Current setup still selects Morphy version 4.
- Rating lookup checks complete support before dispatching by id. Null Chigorin
  values do not borrow Classic/Morphy strength. Existing rated eligibility excludes
  Chigorin. Game creation also refuses an eligible opponent without a measured
  difficulty value, providing a useful guard during later activation.
- Existing saved-game resume operates independently of new-selection gates, retains
  the opponent configuration and uses existing game/worker behavior. The scoped
  change does not alter elapsed clocks, forfeit/archive ordering, coaching identity,
  ownership, storage validation or playing policy. Archive/replay/rivalry retain
  complete configuration identity; rivalry appropriately excludes the random seed.
- New historical wording distinguishes documented openings from designed priorities;
  it makes no measured-strength claim while measurement is pending. Mobile roster
  rules still override the desktop three-column rule. Default/saved theme behavior
  is unchanged.
- Browser fixture edits target the current state-v6 authority. The new tests use
  exported storage keys. Older explicit recovery/migration coverage is not removed.
  Future accepted-rating tests are transparently skipped rather than presented as
  passing rated journeys.

## Verification and limits

Independently ran the required review checks at the exact commit: `npm run typecheck`
and `./node_modules/.bin/eslint . --ext .ts,.tsx,.js,.jsx`; both exited 0. The existing
UI/game/browser suites were not rerun. Their reported evidence remains attributable
to the implementation run: 122 UI/game passes, 3 pending rated-game cases; 14 browser
gate/regression passes, 14 pending rated journeys; 4 saved-game offline journeys;
and 2 theme/accessibility/overflow passes. Automated browser evidence is not physical
device evidence or proof of perceived playing style.

After all levels' frozen measurements are independently accepted, review the exact
immutable value and rated-eligibility changes together. Replace the two deliberately
premeasurement-only UI expectations and run the pending rated/game/account/browser
journeys. In particular, verify all three difficulty values, exact configuration
eligibility, receipt stability, assistance/undo, and old-opponent regressions. Do not
treat this checkpoint verdict as validation of values that do not yet exist.

No source files were changed by this review; only this report was written.
