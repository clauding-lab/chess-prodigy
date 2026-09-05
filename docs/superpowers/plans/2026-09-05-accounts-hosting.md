# Accounts and Public Hosting Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and review these tasks in order.

**Goal:** Deliver private named email accounts and records, a live HTTPS app and a public documented release.

**Architecture:** Express serves Vite output and a Better Auth + SQLite API on one origin. Existing validated chess snapshots remain the data authority, scoped to accounts with optimistic version checks.

**Tech Stack:** React 18, TypeScript, Vite 7, Better Auth 1.7.2, Express 5, better-sqlite3, Node 22, Cloudflare Tunnel, systemd, GitHub.

**Spec:** docs/superpowers/specs/2026-09-05-accounts-hosting.md

## Global constraints

- Preserve chess content, engine behavior and practice-rating policy.
- Password auth by default; no configured email sender or claimed email verification/recovery.
- Guest play stays optional and offline. No personal data cached by service worker.
- User IDs come from authenticated sessions. Bound JSON, validate replay, reject stale writes.
- Never commit secrets, databases or private records. Deployment/publication is explicitly authorized.

### Task 1: Private account and records service

Files: `server/auth.ts`, `server/app.ts`, `server/records.ts`, `server/index.ts`, `tests/server/accounts.test.ts`, `package.json`, lockfile, `tsconfig.server.json`.

- [ ] Write integration tests with real temporary SQLite databases and two authenticated users. Prove unauthenticated reads return 401, cross-origin writes 403, invalid snapshots 400, stale expectedVersion 409, idempotent archive and owner isolation.
- [ ] Implement `createApplication({databasePath,baseURL,secret,staticDir?})` returning `{app,close}`. Better Auth migrations run at startup. Serve `/api/auth/*`, GET `/api/health`, GET `/api/records`, PUT `/api/records`.
- [ ] GET records produces `{version:number, snapshot:Session|null, games:GameRecord[], updatedAt:string|null}`. PUT consumes `{expectedVersion:number,snapshot:Session}` and produces that same envelope. GameRecord is `{id,result,reason,level,playerColor,rated,moves:string[],completedAt:string}`. Include all games up to a documented bounded retention; version starts 0. Reject malformed/oversized content before expensive replay.
- [ ] Protect with actual Better Auth session cookie, same-origin mutations, password 12–128, bounded name, disabled email changes/account linking, persistent auth limits, response no-store, no raw error leakage. Save snapshot+archive+version atomically. Undo removes only current game archive.
- [ ] Test real sign-up/login/logout, password hash at rest, secure production cookie options, durable reopen, all record acceptance cases. Add server start/typecheck commands.

### Task 2: Account UI and safe storage/sync

Files: `src/account/*`, `src/game/useGame.ts`, `src/App.tsx`, `src/main.tsx`, `src/ui/theme.css`, `vite.config.ts`, `tests/account/*`, `tests/browser/accounts.spec.ts`.

- [ ] Test scoped guest/account saves and stale-request cancellation before implementation. Use an injected storage adapter in `useGame(paused, options?)` so default guest behavior and existing tests remain compatible. Expose snapshot transitions through optional callback.
- [ ] Add accessible account modal: create account (name/email/password), sign in, sign out, private recent-game record, change password. State the no-email-recovery limitation at registration. Reuse theme/modal patterns.
- [ ] Read cookie-backed session via Better Auth client; fetch records before mounting account gameplay. Use a keyed shell so account switches cancel chess worker and network callbacks. Leave guest saves untouched.
- [ ] Local account adapter persists snapshot with pending/baseVersion metadata. Serialize PUT writes and do not write every clock tick. Match response to sent snapshot before clearing pending. Reconnect/reload dirty state uses original baseVersion. 409 shows explicit choice; 401 never silently saves under another identity. Never cache API responses.
- [ ] Run real browser registration, resignation archive, reload, second browser login, logout/guest isolation, wrong password, offline guest and conflict resolution. Preserve original 30 journeys.

### Task 3: Deployment and release

Files: `deploy/chess-prodigy.service`, `deploy/README.md`, backup script/timer, `.env.example`, `.gitignore`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `VISION.md`, CI configuration.

- [ ] Prepare isolated service/database paths, secret generated on server, versioned release installation and consistent database backup. Route the new hostname without changing other routes.
- [ ] Review new source for security and TypeScript correctness, fix findings, run all checks and live HTTPS/auth checks.
- [ ] Initialize Git, inspect staged files for sensitive data, create public `clauding-lab/chess-prodigy`, push conventional commits, run CI and publish v1.0.0 release. Do not publish until critical checks pass.
- [ ] Verify public repo/release/live address and record release evidence and remaining physical-device limitation.

### Owner-added task: in-app leaderboard

- [ ] Task 1 exposes GET `/api/leaderboard` as `{players:[{rank:number,name:string,rating:number,games:number}]}`; top100 with at least one rated game, rating DESC/games DESC/stable id. Test ordering, eligibility, reset/undo and private field exclusion.
- [ ] Task 2 adds accessible Leaderboard action/modal with loading/empty/retry and practice-rating label. Registration discloses display-name/rating publication; email stays private.
- [ ] Task 3 documents the public-name/rating scope in README, privacy copy, VISION and release notes.
