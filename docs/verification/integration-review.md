# Production integration review

Reviewed 5 September 2026 (BDT). Read-only production review; no implementation changes.

Scope: `src/game/useGame.ts`, `sound.ts`, `src/App.tsx`, `src/ui/`, `vite.config.ts`, and the corresponding hook/UI/browser tests. Read AGENTS.md, VISION.md, CODEX_HANDOFF.md and the production design/plan. Parent confirmed owner authorisation for the local production build. Core rules/storage/search review is separate.

This workspace has no `.git`, so staged/working-tree and HEAD comparisons are unavailable. The supplied production files were treated as new additions, with a no-index diff against `/dev/null`. PR merge readiness cannot be verified here.

## Checks

- `npm run typecheck`: passed.
- `npx eslint . --ext .ts,.tsx,.js,.jsx`: passed.
- `npx vitest run tests/game/useGame.test.tsx tests/ui`: 15 tests passed across five files.
- Browser verification is being performed by the parent agent; no independent physical-device or update-deployment claims are made here.

## Findings — warning

### MEDIUM: clock expiry retains an obsolete confirmation alongside the result

Locations: `src/App.tsx:381` and `src/App.tsx:398`; supporting modal handling at `src/ui/Modal.tsx:31`.

Reproduction sequence: start a timed rated game, reach the player's turn, open Hint or Resign confirmation, then allow the clock to expire before answering. The game-over effect clears promotion and selection but leaves `confirm` populated. Both ResultModal and ConfirmModal therefore remain mounted. The new result portal is appended above the older confirmation, which survives into subsequent result/review/new-game navigation. The modal implementation excludes every other modal portal from background inert handling, and each instance only remembers the initially non-inert background. Consequently it cannot safely preserve background isolation when overlapping dialogs are removed in a different order.

This is established by the render/effect paths; the existing modal tests only cover a single dialog and StrictMode, not this timed interaction. Clear obsolete game confirmations when the result changes and verify timeout while confirmation is open. If concurrent dialogs remain possible, modal background isolation must account for the active dialog stack.

### MEDIUM: the promised update after game end is behind an undismissable result dialog

Locations: `src/App.tsx:368`, `src/App.tsx:381`, `src/ui/Modals.tsx:177`.

Reproduction sequence: have an update waiting during a game, then resign or time out. UpdatePrompt now renders its Update now control because `active` becomes false, but ResultModal makes the app background inert and cannot be dismissed with Close, Escape or backdrop. Its options are New game and Review game; closing review restores the result. The user must start a new empty game to reach the update control, replacing the finished game's saved board/history first.

The isolated UpdatePrompt tests confirm save-before-update and active-game deferral, but do not cover its integration beneath ResultModal. Provide an intentional route from the result to the update (for example a dismissible result or a result-level update action) and add an application-level update-after-result check. Save failure must continue to block the update.

## Positive findings and limits

The hook uses request generation invalidation alongside game/revision checks, invalidates work on position changes, and ignores late replies after replacement/unmount. Sounds occur in dispatch rather than state updater callbacks, avoiding duplicate StrictMode sound effects. Ordinary display ticks avoid save writes; position/result changes persist after rating settlement. Corrupt-save recovery remains explicit. The opening request now sends legal book continuations rather than played history. Existing tests cover these important paths.

No CRITICAL or HIGH finding was established in this bounded integration review. The two findings above are concrete source-traced UI flows, not independently executed browser reproductions. The parent should verify fixes with focused behavioral regressions and include them in final browser evidence.

## Scoped re-review — original findings resolved

Re-reviewed 5 September 2026 (BDT) after the parent fixes. App now clears obsolete confirmation state when a result arrives. Modal background isolation is coordinated by a shared stack: only its top portal is interactive, and original inert state is restored after the last dialog closes. ResultModal offers View board; dismissal is keyed by game ID and revision, allowing update access without replacing the finished game.

Fresh checks: `npm run typecheck` passed; `npx eslint . --ext .ts,.tsx,.js,.jsx` passed; `npx vitest run tests/ui/App.test.tsx tests/ui/Modal.test.tsx tests/ui/UpdatePrompt.test.tsx` passed all 10 tests. These include real timed reducer expiry while confirmation is open, result dismissal, stacked modal isolation and save-before-update behavior. Both original MEDIUM production findings are resolved.

Narrow inspection of the newly added verification files found two evidence improvements communicated to the parent:

- `tests/browser/update.spec.js`: the real service-worker activation/reload flow is appropriate, but the final assertion only compares game ID and rating. It would pass even if board/history/preferences were lost while those two values survived. Compare the complete ended game and preferences too before describing this as full saved-state preservation.
- `tests/browser/promotion.spec.ts`: the timeout fixture leaves one second on the clock and installs a virtual clock that initially continues advancing during navigation and clicks. A slow run can expire before the picker opens. Pause virtual time for setup/interactions, then advance it explicitly to test the intended race deterministically.

No material verification issue was found in `scripts/check-accessibility.mjs`: it retains browser storage across Lighthouse navigation, saves the chosen theme, audits both themes and fails below the required score. The update fixture changes service-worker bytes while keeping the application build the same; it verifies the actual waiting/activation/reload mechanism, not compatibility across a changed save schema. No physical-device testing is implied.

## Final narrow verification review

The parent addressed both verification recommendations: the update test compares the entire ended game, rating and preferences, while the promotion timeout test pauses virtual time before navigation and picker interaction. The update fixture additionally changes the HTML precache revision, serves a version marker in the new HTML and checks release 2 after activation/reload. This supersedes the earlier limitation that only service-worker bytes changed; save-schema migration between application versions remains outside this test's claim.

Reviewed `tests/browser/worker.spec.js`: it terminates native workers on AI requests, checks exactly two watchdog attempts and unchanged one-ply history, then restores message delivery and verifies the actionable retry produces the legal second move. This meaningfully exercises browser worker recovery rather than replacing the worker client with a mock.

Reviewed `scripts/generate-icons.mjs` and `.github/workflows/ci.yml`. The icon source is original geometric SVG rendered locally by Sharp, with no font or external artwork dependency. CI installs locked packages and Chromium dependencies, runs the existing type/lint/format/test/build/browser gates and retains browser evidence on failure. No material new findings were established in this narrow pass.

Fresh typecheck and requested repository-wide ESLint command passed again. Browser execution and final CI readiness are owned by the parent; this entry records source review rather than claiming an independently executed final browser suite. The integration review is complete with the original findings and subsequent verification recommendations resolved.
