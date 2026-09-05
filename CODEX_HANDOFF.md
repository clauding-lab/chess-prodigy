# Codex Handoff: Chess Prodigy

> Execution update, 5 September 2026 (BDT): the local production candidate is implemented. See docs/verification/release-report.md for current measured checks and physical-device limitations. The text below records the accepted requirements and historical plan.

Updated: 5 September 2026 (BDT, UTC+6).

**Purpose.** Turn the corrected single-file prototype into a maintainable, tested, installable browser app named **Chess Prodigy**. Keep the current two themes and chess-coaching content. The current workspace includes a runnable verification preview; the full production port is planned, not completed.

**Authority.** reference/chess-app.jsx is the corrected behavior reference. reference/chess-app.original.jsx preserves the supplied original for comparison. The seven code fixes below override original behavior, and the eighth fix replaces the obsolete installation checkpoint. Do not copy a known defect for “parity”.

**Read first.** AGENTS.md, VISION.md, docs/superpowers/specs/2026-09-05-chess-prodigy-design.md and docs/superpowers/plans/2026-09-05-chess-prodigy-build-plan.md. The detailed plan expands and governs the checkpoints below.

## 1. Retained behavior and content

- Rules engine: legal moves, castling, en passant, promotion, check, checkmate, stalemate, automatic fifty-move/threefold draws and the existing insufficient-material detection. This is the prototype's practice-game policy, not a claim of complete tournament adjudication.
- Verified move-count positions: start 20 / 400 / 8,902; Kiwipete 48 / 2,039; position 3 14 / 191 / 2,812.
- Search: negamax, alpha-beta, iterative deepening, timed search, capture/promotion quiescence with all legal check escapes, position cache and piece-square evaluation. Casual, Club and Strong retain their configured strengths.
- Opening book: all 185 lines and their name/eco/origin/plan content remain verbatim. All lines are playable with exact generated notation.
- Coach: 27 motif cards/detectors; current fixtures cover a subset. Complete positive/negative coverage for all detectors during the port. Keep structural-delta behavior, evaluation indexing, hints, annotations and full-game review.
- Rating: local FIDE-style practice rating, floor 1400, existing K ladder, expected-score cap and nominal opponent ratings. Hints/takebacks void rating; resignation/abandonment are losses. Display actual applied delta after the floor.
- UI: wooden and dark themes; no clock, 5+0, 10+0, 15|10; captured pieces; flip; FEN export; sound; promotion/setup/result/review/confirmation dialogs. Product title is Chess Prodigy in both themes.
- Keep Unicode U+FE0E text glyphs during this port. SVG replacement is optional later and must preserve its actual licence/attribution; CC-BY-SA assets are not licence-free.

## 2. Eight reviewed issues — required corrections

| Issue | Corrected contract |
|---|---|
| 1. Clock drift | Charge actual elapsed time, settle before accepting moves, and catch up on focus/visibility. Do not subtract a fixed callback amount. |
| 2. Promotion after timeout | Reject all moves after game end; settle expiry before promotion; dismiss pending promotion on result. |
| 3. Stale full review | Cancel queued work on close, replacement, undo, move and unmount. Read the captured history and check job/game identity before applying results. |
| 4. Repetition identity | Include en passant only when a legal capture exists; preserve raw FEN export independently. |
| 5. Quiescence | Check mate/stalemate and deadlines; when checked search quiet escapes as well as captures; never stand pat in check. |
| 6. Black orientation | Derive both player bars from absolute board orientation, independent of human colour. |
| 7. Floor delta | Report after-rating minus before-rating, including zero or partial loss at the floor. |
| 8. Installation gate | Replace Lighthouse PWA score with actual installation, offline reopening and update checks. Retain Lighthouse accessibility >=90. |

Regression tests are in tests/engine.test.js and tests/interface.test.jsx. Desktop/mobile browser journeys are in tests/browser/interface.spec.js. Preserve these checks while replacing the test-only monolith loader with typed-module imports.

## 3. Target architecture

~~~
chess-prodigy/
  src/
    engine/       board, FEN/SAN, eval, search, engine.worker
    book/         unchanged opening lines and lookup
    coach/        motifs and annotation
    rating/       practice rating maths
    game/         pure transitions and useGame hook
    worker/       typed request protocol and cancellable client
    storage/      validated versioned save envelope
    ui/           board, panels, controls, dialogs and both themes
    App.tsx
    main.tsx
  public/icons/
  tests/
  docs/superpowers/specs/
  docs/superpowers/plans/
  docs/verification/
~~~

Vite + React 18 + strict TypeScript; Vitest, React Testing Library, Playwright, ESLint, Prettier and vite-plugin-pwa. No backend or account is required.

Engine and all analysis must run in a Web Worker. Requests carry requestId, gameId and revision. Cancellation must actually stop work by terminating/replacing a busy worker; merely sending a cancel message does not interrupt synchronous calculation. Restart/retry a still-current request once on unexpected worker failure and expose a second failure.

Replace artifact-only window.storage with one authoritative, validated localStorage envelope at chess-prodigy-state-v1 containing game, rating and preferences together. Import a valid legacy chess-fide-rating-v1 value only when no new save exists. Preserve playable memory state and show an unsaved indicator on storage failure. Save results and their rating receipts atomically so reload cannot count them twice.

## 4. Production tasks and checkpoints

1. **Typed engine.** Extract corrected board/eval/search; add validated fromFEN. Checkpoint: all three move-count positions, notation, terminal/search/deadline regressions; typecheck/lint/build clean.
2. **Book and coach.** Preserve all content; extract lookup/detectors/annotations. Checkpoint: 185 playable lines, all 27 detectors covered by positive/negative fixtures, correct White-perspective eval indexing.
3. **Pure game/rating state.** Explicit timestamps, terminal guards, history revisions, exactly-once rating receipts. Checkpoint: late move/promotion, undo, repeated settlement, floor and abandonment tests.
4. **Worker.** Tagged, cancellable requests; one retry on crash/watchdog. Checkpoint: flip and interact during Strong search; no stale results after restart/undo; failure recovery tested.
5. **React UI.** Wire state/worker, port both themes with Chess Prodigy branding and keyboard-operable squares/dialogs. Checkpoint: desktop/390 px parity, full keyboard move flow, focus management and all existing browser journeys.
6. **Persistence.** Validated game/rating/preferences envelope; settle clocks on reload. Checkpoint: reload retains game/rating/flags; interrupted settlement never duplicates rating; corrupt/unavailable storage stays playable.
7. **PWA.** Local assets, manifest/icons, offline worker and safe update prompt. Checkpoint: Android Chrome and iOS Safari installation/launch, cached offline reopening and play, update preserves state, accessibility >=90 plus manual keyboard check.
8. **Release candidate.** CI, independent review, documentation and measured device evidence. Checkpoint: clean install, all tests/typecheck/lint/format/build/browser gates; present candidate before publishing.

Do not start by erasing the current verification workspace or replacing the app with an empty scaffold. Keep it runnable while extracting modules.

## 5. Motif test fixtures (FEN → move → expected key)

| FEN | Move | Expect |
|---|---|---|
| `r3k3/8/N7/8/8/8/8/4K3 w - - 0 1` | Nc7+ | fork |
| `rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4` | Bg5 | pin |
| `4k3/8/8/8/8/8/4N3/4RK2 w - - 0 1` | Nc3+ | discovered |
| `4k2q/8/8/8/8/8/8/R3K3 w - - 0 1` | Ra8+ | skewer |
| `r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4` | Bxf7+ | sacrifice |
| `rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2` | f4 | gambit, pawnbreak |
| `r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5` | O-O | castle |
| `rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3` | exd6 | enpassant |
| `6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1` | Ra8# | backrank (pass `over.reason = "Checkmate"`) |
| `8/8/8/4k3/8/8/4K3/8 w - - 0 1` | Ke3 | opposition, activeking |
| `r1bqkb1r/pp4pp/2n1pn2/2pp1p2/3P4/2P1PN2/PP3PPP/RNBQKB1R w KQkq - 0 6` | Ne5 | outpost |
| `r1bqkbnr/pppp1ppp/8/4p3/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4` | Nxe5 | *no fork* (targets defended) |

Negative cases matter as much as positive ones: the detectors are tuned to stay quiet.


## 6. Non-goals and remaining boundaries

- No online play, accounts, server or paid service.
- No Stockfish/WASM replacement in v1.
- No new opening or motif content during the port.
- Desktop mobile emulation does not establish physical Android/iOS performance or installability.
- The current preview still uses artifact-only window.storage and performs engine work on the interface thread. Replacing these is production work in the detailed plan.

## 7. Definition of done

All automated tests pass; strict typecheck, lint, formatting and build pass; accessibility >=90 plus keyboard review; an actual named mid-range Android phone can play Strong responsively; rating and in-progress game survive reload; installation/offline reopening/update checks pass on Android/iOS; the coach retains every supplied card verbatim.

There is no Lighthouse PWA-score requirement. Google removed the category in Lighthouse 12: https://developers.google.com/speed/docs/insights/release_notes

## 8. Execution prompt

~~~
Build Chess Prodigy from the corrected reference/chess-app.jsx. Read AGENTS.md, VISION.md, CODEX_HANDOFF.md, the design and the detailed build plan first.

Execute the production plan task-by-task, preserving the eight approved corrections and all opening/motif content. Run every checkpoint and stop to resolve real failures before moving on. Keep the local app runnable during extraction. Use British English and BDT in user-facing reports. Keep the custom engine and both themes.

A preview build is not completion of the production port. Do not claim physical-device installation, offline operation, accessibility or worker responsiveness without performing those checks. Prepare a concrete release candidate before any publishing decision.
~~~
