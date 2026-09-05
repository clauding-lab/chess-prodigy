# Historical local production candidate

This report predates accounts and public hosting. Machine-generated logs remain local and are excluded from the public repository.

Verified 5 September 2026, 20:12 BDT. Production entry: `src/main.tsx`. The local candidate is implemented and the automated release checks pass. Physical Android/iOS qualification remains pending; no public deployment, push or merge was performed.

## Implemented

- Typed rules/search engine, with calculation isolated in a cancellable browser worker. Preserved Casual/Club/Strong settings, all 185 opening lines and all 27 coaching cards/prose.
- Elapsed clocks, terminal move/promotion guards, repetition rules, White-perspective evaluations and exactly-once rating receipts. Undo restores the pre-turn clock snapshots and voids that game's rating.
- Wooden/dark interface with keyboard board navigation, named promotion choices, focus-trapped dialogs, cards, hint/review, captures, FEN copying and practice-rating history.
- Versioned local save with legal history replay, bounded clocks, validated coaching/evaluations and complete rating receipt recomputation. Corrupt data remains intact until explicit recovery. Storage failure leaves play available.
- Manifest and original local rook icons, cached app and engine, offline reopening/play/review, and explicit save-before-update behaviour. View board dismisses a result so updates and the final board remain accessible.
- CI workflow, Node version pin, clean dependency audit and reproducible verification commands. CI was written and its commands verified locally; there is no remote CI run because this workspace is not a Git repository.

## Final command evidence

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | Pass; zero known audit vulnerabilities | Install log (local artifact) |
| `npm run typecheck` | Pass | Typecheck log (local artifact) |
| `npm run lint` | Pass; no source warnings | Lint log (local artifact) |
| `npm run format:check` | Pass | Formatting log (local artifact) |
| `npm test` | **149 tests, 15 files passed** | Test log (local artifact) |
| `npm run build` | Pass; app 253.32 kB / 84.94 kB gzip; worker 9.19 kB; 14 offline-cache entries | Build log (local artifact) |
| `npm run test:browser` | **30 passed** across desktop and mobile-emulated Chrome | Browser log (local artifact) |
| `npm run test:accessibility` | **100/100 wood; 100/100 dark** | Log (local artifact), wood JSON (local artifact), dark JSON (local artifact) |

The clean-install run's first browser pass exposed a test assumption: a legal book prefix such as `e4 g6` need not yet have a named opening. The assertion now checks correct book membership, preserving native engine randomness. After that test-only correction, the full browser suite passed; production code was unchanged from the clean-install checks. The reviewer confirmed the corrected assertion against the preserved repertoire.

npm reports deprecation notices for transitive whatwg-encoding/glob and the currently pinned ESLint 9 line; audit reports zero vulnerabilities. No forced dependency override was used.

## Browser evidence

Machine: **Mac17,9, Apple M5 Pro, arm64, macOS 26.6.2 (25G83)**. Browser: **Google Chrome 152.0.7977.82**. Build/check runtime: Node 22.23.0. Viewports: 1280×1000 and mobile-emulated 390×844.

Automated journeys cover legal play and both themes; Black orientation/flip; hint/takeback/review; applied zero rating loss at the floor; Strong out-of-book play; delayed clock callbacks; complete game/rating/theme reload; keyboard moves and dialog isolation; corrupt-save protection and explicit recovery; underpromotion; promotion timeout; offline reopening and engine/review; native-worker watchdog failure/retry; and a real waiting service-worker update preserving the complete ended game, history, board, rating and preferences.

Update verification serves an older and newer HTML revision through a local test server and the actual generated service worker, then verifies the newer HTML marker after explicit acceptance. Active play defers the update, and unit checks prove a failed save blocks reload. No future schema migration is claimed: both test releases use saved-state version 1.

The Strong-search heartbeat had maximum interface gaps of **60.9 ms desktop** and **59.7 ms mobile emulation**, below the 250 ms acceptance bound, with four 50 ms samples per run. These are this machine's short-search measurements, not phone performance claims. Recorded measurements (local artifact).

Axe checks reported no WCAG A/AA violations in either theme at either viewport. White-piece outlines and dark-theme primary-button text were adjusted only to correct measured contrast failures. Full-page screenshots were visually inspected:

- [Desktop wood](desktop-wood.png), [desktop dark](desktop-dark.png)
- [Mobile wood](mobile-wood.png), [mobile dark](mobile-dark.png)

Original rook icon dimensions verified: 192×192, 512×512, 512×512 maskable, 180×180 Apple touch. The maskable background is opaque; the rook fits within its central safe area. No external image/font licence is required.

## Independent review

[Core review](core-review.md): four reproduced findings resolved and re-reviewed — invalid saved coaching/evaluation data, clock/control consistency, rating rollback consistency, and root automatic-draw search.

[Integration review](integration-review.md): two findings resolved and re-reviewed — timeout during confirmation and result dialog blocking update access. Subsequent test-quality recommendations were applied, including complete saved-game update comparison and deterministic promotion timeout timing. Final scoped review found no remaining material issues.

## Boundaries and remaining release qualification

- Physical Android Chrome / iOS Safari installation, offline launch, background-clock and performance checks are **pending**. See [device checklist](device-checklist.md). No connected phone was available. Desktop mobile emulation does not satisfy those checks.
- The app remains local and unpublished. Phone installation needs a secure reachable address; no hosting/account/domain change was made.
- One playing tab is supported. Live coordination between multiple simultaneously playing tabs is not implemented. Saves are browser/device-local; clearing site data removes them.
- The preserved automatic threefold/fifty-move draw policy and insufficient-material rules remain those of this practice app, not a tournament-complete rules claim.
- The original doubled-pawn motif detector recognises newly doubled enemy pawns, which a legal move cannot create. Its prose/semantics were preserved and its impossible positive fixture is documented in the coaching tests; no new chess content was invented to conceal this limitation.

There is no Git commit identifier in this non-git workspace. Source fingerprint and included file list (local artifact): SHA-256 `fa12e2c40559d8565da84aeb2c550d4e2b411d84fba75b57a22f873582151874`.
