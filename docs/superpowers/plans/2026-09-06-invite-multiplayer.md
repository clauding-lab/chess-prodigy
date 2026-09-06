# Invitation multiplayer implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task with review; the controller handles independent integration work locally.

**Goal:** Ship invitation-based human chess, separate Elo and H2H, email/push reminders, editable names and working audio.
**Architecture:** Express and SQLite own shared games and durable notification jobs. React reuses the existing board and coaching components; polling refreshes online matches. Brevo and Web Push deliver opt-in alerts without blocking play.
**Tech Stack:** Existing TypeScript/React/Express/SQLite, Web Audio, web-push, existing Workbox service worker.
**Spec:** docs/superpowers/specs/2026-09-06-invite-multiplayer-design.md

## Global constraints
- Node >=22.19; preserve original 185 opening lines and 27 motif records.
- No paid service; no secret or private database in Git.
- One reminder per overdue turn, after ten minutes, no automatic forfeits.
- FIDE Rating always qualified as unofficial computer practice; 1v1 starts 1200, K=32, provisional for ten games.
- Keep private records and multiplayer separate; account IDs, never names, identify owners.
- Source checks, behavioral tests, browser verification and independent final reviews precede release.

### Task 1: Shared game service
Files: src/multiplayer/types.ts; server/multiplayer.ts; tests/server/multiplayer.test.ts.
- [x] Write integration tests for authenticated invite/accept/move/result, self/third-party rejection, stale revisions, draw/resign, duplicate completion, Elo/H2H, expiry and rename continuity.
- [x] Run tests to establish missing routes fail (404 instead of expected 201).
- [x] Implement createMultiplayerRouter(database, auth, baseURL); separate SQLite tables and transactions. Public leaderboard handled by GET /leaderboard before authenticated middleware. List GET / returns {games, rating, opponents}; POST /invites {color} returns {id,token}; POST /join {token} returns game; GET /:id returns game; POST /:id/{move,resign,draw,cancel} validates expectedRevision. Full shared types live in src/multiplayer/types.ts.
- [x] Expose durable events through mp_events(game_id,revision,user_id,kind,due_at) with a unique event identity; kind started/reminder. New turns cancel old pending reminders at delivery check.
- [x] Run integration tests and typecheck; review and commit task.

### Task 2: Reliable notification delivery
Files: server/notifications.ts; server/notification-delivery.ts; server/app.ts; server/index.ts; public/push-handler.js; vite.config.ts; tests/server/notifications.test.ts; .env.example.
- [x] Test a controllable clock across the ten-minute boundary, per-channel once-only delivery, stale turns, retry persistence, subscription validation and account isolation.
- [x] Implement authenticated GET/PUT /api/notifications/preferences, POST/DELETE /api/notifications/push, GET /api/notifications/config. Private durable delivery rows and device subscriptions; allowed push endpoints only; bounded requests/retries. Worker revalidates turn before sending.
- [x] Integrate Brevo API and web-push with timeouts and private env configuration. Clear device subscription on logout; push handler opens only fixed-origin game URLs. Preserve prompt updates.
- [x] Run targeted tests and production build; review and commit.

### Task 3: Multiplayer interface and identity
Files: src/multiplayer/{api.ts,Multiplayer.tsx,notifications.ts}; src/account/{AccountShell.tsx,AccountModals.tsx,api.ts}; src/ui/theme.css; tests/browser/multiplayer.spec.ts.
- [x] Browser tests: invite survives registration, other account joins, each player moves, reload restores, resign updates ratings and H2H, edit name retains identity.
- [x] Add URL-driven /invite/:token and /game/:id views; keep practice mounted and paused when multiplayer is active. Registered My games/create invite, copy fallback, polling with stale-response protection, promotion, draw and resignation confirmation, completed coaching and review.
- [x] Add account name editing and separate leaderboard tabs; existing rating heading gains requested wording and persistent unofficial qualifier.
- [x] Add per-device push opt-in and email preferences; no prompt until player explicitly enables push.
- [x] Run browser and source checks; review and commit.

### Task 4: Sound repair
Files: src/game/sound.ts; src/App.tsx; tests/game/sound.test.ts; tests/browser/sound.spec.ts.
- [x] Reproduce audio activation failure with suspended AudioContext and intentional enabling gesture.
- [x] Add async activation, wait for running context before scheduling, test tone on enable, user-visible failure, gesture-based recovery; never replay old moves.
- [x] Run targeted tests plus browser Web Audio output instrumentation; review and commit.

### Task 5: Release
Files: AGENTS.md; VISION.md; README.md; CHANGELOG.md; docs/verification/release-report.md; deploy/runbook.md; package.json.
- [x] Full tests/typecheck/lint/format/build/browser/accessibility and independent code/TypeScript/security reviews.
- [x] Locate existing Brevo sender/key privately; configure push keys. If credentials unavailable, finish code/tests and report exact missing deployment input without exposing secrets.
- [x] Backup database, deploy verified release using existing runbook, verify public health/static assets and controlled multi-account journeys. Publish conventional commits/release and update evidence with actual results.

Completed 6 September 2026 BDT. Code release v1.2.0 at413cbab; full measured results and live verification are in docs/verification/release-report.md.
