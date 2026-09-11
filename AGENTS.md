# Chess Prodigy — agent instructions

Chess coach with optional private accounts and a public hosted application. Read VISION.md and docs/verification/release-report.md for current shipping status; CODEX_HANDOFF.md and docs/superpowers/ record the original requirements and accepted build plan.

## Commands
- Use Node >=22.19; `nvm use` selects the version in .nvmrc.
- `npm ci` — install locked dependencies.
- `npm test` — rules, game, storage, worker and React regression checks.
- `npm run typecheck`, `npm run lint`, `npm run format:check` — source checks.
- `npm run build` — production bundle with offline service worker.
- `npm run dev -- --port 5173` — local development preview.
- `npm run preview -- --port 4173 --strictPort` — built app for offline checks.
- `npm run test:browser` — starts built preview; Chrome locally, Chromium in CI.
- `npm run test:accessibility` — Lighthouse against running port 4173 preview; both themes >=90.

## Structure
- `src/engine`, `book`, `coach`: typed engine and preserved coaching content.
- `src/game`, `rating`: pure transitions and React/background-work connection.
- `src/storage`: validated authoritative local save.
- `src/worker`: request identities, cancellation and failure recovery.
- `src/ui`, `App.tsx`, `main.tsx`: production interface.
- `reference/chess-app.original.jsx`: immutable supplied baseline.
- `reference/chess-app.jsx`: corrected behavioural reference.
- `verification/`: retained historical prototype entry.
- `tests/`: production and original prototype regressions.
- `docs/verification/`: measured evidence and outstanding device checks.

## Landmines
- Preserve all 185 opening lines and 27 coaching cards/prose. Content changes require owner review.
- On 5 September 2026 BDT the owner approved expanded sourced stories in `src/coach/stories.ts` and `openingStories.ts`, retaining the original records while superseding displayed motif prose. Keep historical examples distinct from inventorship claims and position evaluation. Match opening-family stories by move prefix; preserve full-game coaching history and safe cancellation of the minimum reply delay.
- Original prototype never overrides the eight approved corrections.
- Use elapsed wall-clock time; reject moves after game end; tag/cancel asynchronous work by game identity and revision.
- Evaluation scores use White's perspective; search internals use side-to-move perspective.
- `chooseAiMove` and worker `bookSans` receive legal opening continuations, not moves already played.
- Repetition keys include en passant only when a legal capture exists.
- One versioned local save contains game, rating receipt and preferences. Validate unknown input and legally replay history. Never silently overwrite corrupt saves.
- Hints/takebacks void rating; undo reverses only its own receipt. Save transitions, not every display tick.
- Modals use portals with stack-aware inert background handling; keep React StrictMode regression coverage.
- PWA updates require explicit action after saving; never force an active-game reload.
- Tests exercise real behaviour, not source text. Browser emulation is not physical-device evidence.
- Accounts, private records, hosting at chess.clauding-lab.com and a public GitHub release were explicitly authorized on 5 September 2026 BDT. No Stockfish or paid service additions.
- Derive record ownership from authenticated sessions. Keep secrets/SQLite outside release code; never publish them.
- Guest and user saves are isolated; preserve pending sync versions and reject conflicting device writes.
- Email is an unverified login ID; do not claim email verification or forgotten-password recovery.
- Conventional Commits, BDT, plain-English explanations, no force push, skipped hooks or destructive operations without sign-off.

## Accounts and hosting

- `npm start`: full app/API on 4317, reads optional local `.env`; build frontend first.
- `npm run typecheck`: frontend and server TypeScript. `npm run test:server`: real SQLite/auth integration checks.
- `server/`: Better Auth, private records, bounded input, version conflicts and public leaderboard projection.
- `src/account/`: account interface and versioned local/cloud synchronization.
- `deploy/`: isolated systemd service, private database backups and runbook.
- Browser suite starts a separate disposable full-stack server at 4318; never point tests at a real player's database.
- Public leaderboard may show display names, practice ratings and rated-game counts only; registration must disclose this. Email and individual games stay private.

## Multiplayer and notifications — v1.2.0

- `server/multiplayer.ts` owns authoritative untimed human games, atomic Elo/H2H completion and invitation hashes. `src/multiplayer/` owns the separate UI; never route a human game through computer-opponent work.
- 1v1 starts at 1200, K=32; games <10 provisional. Human ratings/H2H cannot be reset by clients. Practice calculations are unchanged, displayed as Practice Rating with an explanation that it measures performance within this app (Run 2, 11 September 2026 BDT).
- `mp_games.turn_revision` identifies a turn independently of draw-offer revisions. Use `isMultiplayerEventCurrent` for reminder checks. One event per overdue turn; no time forfeits.
- `server/notifications.ts` persists channel/device jobs and bounded retries; `notification-delivery.ts` uses private Brevo/VAPID configuration. Public push endpoints are allowlisted; never accept arbitrary outbound URLs.
- Reconcile push ownership before opening another account or confirmed guest session. Browser unsubscribe failures block switching; never show one account while retaining another account’s subscription.
- `public/push-handler.js` extends Workbox; preserve explicit updates and offline practice. Tests never send real email/push.
- Production notification worker starts only with ApplicationOptions.notifications; await application.close() before database removal/shutdown when it is enabled.
- On 7 September 2026 BDT the owner approved a top H2H tab after the first completed 1v1 game. Reuse lifetime participant-only records; both opponents see their shared results, unrelated players do not. Refresh eligibility after completion in the board or lobby; discard stale account responses.
- Owner approved basic participant-only text/emoji chat and typing dots on 7 September 2026 BDT. `server/chat.ts` is volatile memory only: no transcript in SQLite, logs, saved games or browser storage. Either participant leaving clears the room; missing presence expires within 30 seconds. Preserve session tombstones, epoch checks and client response ordering. Close the chat timer with the application.
- Later that day the owner approved the top Chat unread dot and removal of emoji from UI wording (player emoji input remains supported). Unread state is local to the mounted chat, clears on room erasure/read, ignores own messages, and treats hidden tabs as unread. Keep reduced-motion support and completed-tap audio activation; pending browser resume attempts must not block fresh gestures.

## Local personality development — 11 September 2026 BDT

Read revision 2 of `CHESS_PRODIGY_BUILD_HANDOFF.md` and the dated Run 1 records in
`docs/plans/2026-09-11-personality-pwa.md` and `docs/verification/2026-09-11-personality-pwa.md`.
This pass authorizes local feature-branch checkpoints only: no push, PR, merge, deployment,
publication or live player data. Neutral review must validate purpose/version/policy and
position/history identity; opponent scores and legacy scores never qualify. Preserve exact
legacy wire acknowledgements at the server; normalize derived review data at client boundaries.

The owner subsequently invoked Run 2 (“go on”): local, default-off playable Paul Morphy beta
and its safe persistence/rating dependencies. See the `2026-09-11-personality-pwa-run2.md`
plan and verification records. New saves use schema/key v2; v1 originals remain for recovery.
Do not downgrade a v2 account snapshot or substitute an unavailable opponent configuration.
Morphy is always unrated; Classic mathematics and 1v1 are unchanged. Run 3 UI remains deferred.
