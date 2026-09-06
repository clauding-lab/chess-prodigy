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
- 1v1 starts at 1200, K=32; games <10 provisional. Human ratings/H2H cannot be reset by clients. Practice calculations are unchanged, displayed as FIDE Rating with a visible unofficial qualifier.
- `mp_games.turn_revision` identifies a turn independently of draw-offer revisions. Use `isMultiplayerEventCurrent` for reminder checks. One event per overdue turn; no time forfeits.
- `server/notifications.ts` persists channel/device jobs and bounded retries; `notification-delivery.ts` uses private Brevo/VAPID configuration. Public push endpoints are allowlisted; never accept arbitrary outbound URLs.
- Reconcile push ownership before opening another account or confirmed guest session. Browser unsubscribe failures block switching; never show one account while retaining another account’s subscription.
- `public/push-handler.js` extends Workbox; preserve explicit updates and offline practice. Tests never send real email/push.
- Production notification worker starts only with ApplicationOptions.notifications; await application.close() before database removal/shutdown when it is enabled.
