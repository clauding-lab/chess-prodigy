# Chess Prodigy — prototype fixes and browser verification

Date: 5 September 2026, BDT (UTC+6).
Scope: correct the eight reviewed issues, verify the browser interface, and prepare the production build plan.

## Result

Seven code defects corrected; obsolete handoff checkpoint replaced. Product named Chess Prodigy in both themes and the page title. Original opening/motif content retained.

### Regression evidence

- Before changes: 12 substantive failures / 8 passes across the initial 20 checks.
- Final: 26 Vitest logic/React component tests passed (2 files).
- All three standard move-count positions passed: start 20/400/8902; Kiwipete 48/2039; position 3 14/191/2812.
- All 185 opening lines played with exact SAN; immutable opening/motif content comparison passed.
- All 12 supplied motif fixtures passed. Full 27-detector positive/negative coverage remains in the production plan.
- Additional independent-review regressions: review cancellation between batches, replacement, undo and unmount; sound preference/undo do not replay audio; a new game's first move does play audio.
- Late move submission is rejected after elapsed-time expiry even if no display timer has fired.
- Promotion picker closes at timeout and cannot revive the game.

### Browser interface

12 Playwright checks passed, six journeys in each of two Chrome configurations:
- Desktop: 1280x1000.
- Mobile emulation: 390x844, touch/mobile settings. This is Chrome on the Mac, not Safari or a physical phone.

Journeys:
1. Chess Prodigy name, 64 squares, legal e4/e5, opening card, wooden/dark themes and no horizontal overflow.
2. Play Black with clocks; labels follow pieces before/after flipping.
3. Hint confirmation voids rating; undo restores board; review closes and restart is safe.
4. Rated resignation at the floor shows +0.0 and rating 1400 consistently.
5. Strong produces an out-of-book reply; no page errors observed in the checked flow.
6. Simulated 10-second callback delay charges elapsed time; simulated further expiry ends the game with a stable result.

The clock test was corrected to install time control before app timers and wait for the engine reply/React paint. The original immediate read could inspect the previous side or a pre-update clock. Final assertions wait for the user-visible state; the actual production clock logic was unchanged for this test correction.

All four settled-theme screenshots were inspected:
- [Desktop wooden](desktop-wood.png)
- [Desktop dark](desktop-dark.png)
- [Mobile wooden](mobile-wood.png)
- [Mobile dark](mobile-dark.png)

Screenshot capture disables animations to finish colour transitions; earlier mid-transition captures were not used as final theme evidence.

### Build

npm run build: PASS.
Vite 7.3.6, React 18.3.1.
26 modules, JavaScript bundle 248.92 kB / 82.89 kB gzip.
Dependency installation audit: 0 vulnerabilities reported at installation.

### Independent review

Code review and JavaScript/React review performed. Cancellation coverage strengthened and both audio findings reproduced and corrected. Final narrow audio correction reviewed with no remaining finding.

## Eight-issue mapping

| Issue | Implementation/evidence |
|---|---|
| Clock drift | settleClock uses timestamps; tick/focus/visibility and move submission settle elapsed time; unit and browser delay tests. |
| Promotion after timeout | reduceMove terminal guard and expiry check; UI clears promotion on game end; real-component test. |
| Stale review | captured game snapshot, generation/token guards, timeout cleanup on close/restart/undo/move/unmount; component tests. |
| Repetition | legal en-passant availability in posKey, raw FEN retained; threefold and pinned/legal en-passant tests. |
| Quiescence | check escapes, mate/stalemate, deadlines, legal timeout fallback; mate/quiet-escape/budget tests. |
| Black orientation | absolute top/bottom colour derived from flipped; component and browser checks. |
| Rating delta | after minus before; zero/partial floor cases and browser resignation/timeout. |
| Installation checkpoint | handoff/spec/plan require actual install/offline/update checks; accessibility score retained, no PWA score. |

## Boundaries and next step

This is the corrected prototype preview, not the completed TypeScript/offline production app. Engine calculation still runs on the interface thread; this report does not claim responsiveness under a two-second worker search. The artifact-only storage API is not available in normal Chrome, and the preview accurately shows that rating is not saved.

No full keyboard/accessibility audit, Lighthouse score, physical Android/iOS installability, offline service worker or persistent in-progress-game test is claimed. Those are explicit, testable tasks in the [production build plan](../superpowers/plans/2026-09-05-chess-prodigy-build-plan.md).

No commit, push or deployment was made. The local preview remains available while its dev-server process is running.

## Updated supplied files

The verified reference is copied back to the original Downloads folder/chess-app.jsx.
The corrected handoff is copied back to the original Downloads folder/CODEX_HANDOFF.md.
Originals are retained in the workspace and as dated .before-2026-09-05-review.bak files beside the supplied files.
