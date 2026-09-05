# Chess Prodigy — production design

Status: proposed production design; the eight prototype corrections are authorised and implemented separately.
Date: 5 September 2026 (BDT, UTC+6).
Working directory: repository root.

## Product and scope

Chess Prodigy is a browser-only chess practice app with a custom opponent, opening explanations, motif cards, hints, post-game review and a device-local practice rating. Preserve the wooden and dark themes, the 185 opening lines, all 27 motif cards and their prose. Name the visible app, document title, install manifest and icons Chess Prodigy. Use British English.

The current deliverable is a corrected, runnable prototype plus verification and a production plan. It is not yet an installable, persistent production app. Do not mark the future tasks complete because the preview builds.

## Options considered

1. Keep the single file and add storage/installation: cheapest initially, but tightly couples clocks, analysis and rendering and makes future changes difficult to verify.
2. Extract the existing engine, coaching and game state into typed modules, then connect a Web Worker: recommended. Preserves the product and makes the complex rules independently testable.
3. Replace the engine with Stockfish or add a server: outside the supplied non-goals; introduces a different product and unnecessary infrastructure.

## Architecture

Use Vite, React 18 and strict TypeScript. Vite serves and bundles the browser code; TypeScript checks data shapes before release. A Web Worker is a separate browser execution thread that performs engine work without blocking clicks or clock painting. No API server, database service, account, payment provider or external integration is needed.

- engine/: board rules, notation, position parsing, evaluation and search.
- book/: immutable content and lookup tree.
- coach/: motif detection and annotations.
- game/: pure transitions plus a React hook connecting controls, worker responses and clocks.
- rating/: existing practice-rating maths, including actual applied delta.
- storage/: one validated, versioned local save envelope containing rating, game and preferences.
- ui/: board, player bars, coach/rating panels, controls and accessible modal components.
- public/: locally served manifest and icons; all required assets available offline.

The corrected reference/chess-app.jsx is the behavior reference. The immutable original is a comparison fixture only. The eight approved corrections override original behavior. Known prototype limitations are explicit future requirements, not implicit approval to reproduce them.

## Correctness contracts

- Clocks use elapsed timestamps, not callback counts. Settle the outgoing side before every move, resignation and abandonment; time expiry takes precedence over a late move.
- Clockless games retain clockless behavior. Preserve the prototype convention that the clock starts after the first move. A timed game continues to consume the active side's time while hidden or closed; settle it on restoration. Wall-clock manipulation is outside a local practice app's trust boundary.
- Game result and rating settlement happen exactly once. An ended game rejects promotion and every other move. Undo voids the game and reverses only its own prior rating settlement.
- Tag work by game ID, position revision and request ID. Changing game/history invalidates pending AI, hint, coaching and review responses, even if the new history has the same length.
- Repetition identity includes en passant only if a legal capture exists. Raw FEN still preserves its en-passant target.
- Quiescence (extra tactical search through captures) checks terminal states and deadlines, searches all check escapes and never treats being in check as a valid pass. Search timeout returns the best completed iteration, or a legal fallback with an honest depth of zero.
- evals[ply] evaluates the position after that many half-moves, from White's perspective. AI search may supply the evaluation of the position it faced; book replies provide no search evaluation. Never silently treat a checkmated position as zero.
- Rating floor remains 1400; K ladder, expected score and engine nominal ratings remain unchanged. delta is after minus before, including zero at the floor. This is a local FIDE-style practice rating, not an official rating.
- Orientation is absolute: White at the bottom unless flipped. Player names, clocks and captures follow the visible piece colour, irrespective of which colour the human chose.

## Worker scheduling and failure

One worker, one active request. AI move work outranks passive coaching/review. Hint and review work are cancellable. A cancel message alone cannot interrupt synchronous JavaScript already executing inside a worker; terminate that worker for immediate cancellation and create a replacement. Reject pending promises with an AbortError, discard old-generation responses, and clear thinking/reviewing states.

On an unexpected worker error or watchdog expiry, restart and retry the same still-current request once. A second failure shows an actionable retry control; it must not silently choose a random move. Use request-specific watchdogs: engine budget plus 1000 ms transport/startup margin. Do not put clocks or rating persistence inside the worker.

## Persistence

Use a single authoritative localStorage key, chess-prodigy-state-v1:
{ version: 1, rating, game, preferences }. Write game result and its rating receipt together so refresh cannot duplicate or lose a settlement. Import a validated legacy chess-fide-rating-v1 value once only when no authoritative save exists; never migrate by overwriting a valid newer save.

Validate finite bounded numbers, recognised enum values, legal starting state/history, kings, castling/en-passant fields, rating history and receipt consistency. If loading or writing fails, retain playable in-memory state and visibly report that saving is unavailable. Do not overwrite corrupt saves silently. Save on moves, undo, hint use, result, new game, preference changes and visibility/pagehide boundaries; avoid writing every 200 ms display tick.

Persist last-settled clock timestamp and remaining time. On reload, replay history to validate the board, settle elapsed time, apply any resulting timeout/rating once, then start worker work. A promoted pawn pending a choice remains the original board position on restore; clock continues and the picker can be reopened.

## UI and accessibility

Preserve layout and theme colours; no visual redesign. Keep U+FE0E Unicode pieces for this port to avoid adding asset/licensing uncertainty. If SVG pieces are later chosen, retain their actual licence and attribution; CC-BY-SA is not licence-free.

Use keyboard-operable board squares with square/piece labels, arrow-key navigation, Enter/Space select-and-move and Escape deselect. Promotion buttons identify their piece. Modal dialogs trap focus, have names, make the background inert, support appropriate Escape cancellation and restore focus to their trigger. Do not allow Escape to silently abandon a mandatory promotion. Live-region announcements cover check, turn, move, result and worker errors without announcing every clock tick.

Respect reduced-motion preferences across all transitions. Test readable colours in both settled themes, visible focus and no horizontal overflow at 390 px. Lighthouse accessibility >=90 is an additional check, not proof that a full chess game is keyboard playable.

## Installation and offline behavior

Build a PWA (installable web app) using vite-plugin-pwa with explicit update prompting, local icons and a precached app shell including the worker. Do not reload an active game automatically when a new version is available; save first and let the user choose when to update.

Acceptance: install and launch on Android Chrome and iOS Safari; once cached, close and reopen offline and complete a local game with engine and coaching content. Verify update from an older build preserves saved state. There is no Lighthouse PWA-score gate: Google removed that category. Keep Lighthouse accessibility >=90.

## Scope boundaries

No online play, accounts, server, new opening/motif content or engine replacement. Publishing is a later decision. Current browser evidence uses desktop Chrome and mobile emulation on this Mac; it is not physical Android/iOS testing.

The production port should retain the prototype's documented automatic threefold/fifty-move draw policy rather than claim tournament-complete adjudication. Any change to that policy or broader FIDE edge-case behavior needs a separately described decision.

## Release evidence

Logic tests, React interaction tests, browser journeys, clean strict typecheck/lint/build, installation/offline/update checks and named physical-device responsiveness evidence. Preserve the original content and all eight regression fixes. Report unperformed device checks explicitly; never mark them green based on desktop emulation.
