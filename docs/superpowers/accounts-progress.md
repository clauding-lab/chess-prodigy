# Accounts release ledger

Plan: plans/2026-09-05-accounts-hosting.md

Ruling: Work in existing unversioned project until initial Git publication. There is no parent Git branch/worktree to isolate. Preserve the completed local candidate and original reference.
Ruling: Latest explicit user request supersedes old no-accounts/no-hosting boundaries; public push/release/deploy are authorized. No extra approval gates.
Ruling: Password auth is the practical default because no email sender is configured; optional preference pending, default communicated. Email addresses remain unverified identifiers.

| Boundary | Check | Result |
| --- | --- | --- |
| Task 1 ↔ 2 | GET/PUT envelope + snapshot schema | fixed exact version/snapshot/games interface |
| Task 2 ↔ 3 | API paths vs service worker | deny /api navigation fallback, never cache private responses |
| Task 1 ↔ 3 | persistent database and server environment | agree on DATABASE_PATH/BASE_URL/AUTH_SECRET/PORT, verify before deploy |
| Task 1 | validation tests vs implementation | real sessions, temp SQLite, replay and concurrency rejection required |
| Task 2 | guest backward compatibility | default useGame signature preserved, optional storage adapter |
| Task 3 | publication vs data privacy | ignore environment/database/logs, inspect staged files |

- Task 1 running: accounts_service agent owns server/tests/server/package/lockfile/tsconfig.server.
- DNS CNAME created for chess.clauding-lab.com using existing authorized tunnel certificate; existing routes unchanged.
- Root preparing isolated service and daily consistent database backup.
- Owner addition: public in-app leaderboard of name and practice rating. Updated spec, plan and backend task; registration disclosure required. This supersedes initial no-leaderboard boundary.
- Task 1 complete: Better Auth/SQLite service, private snapshots + 200-game archive, leaderboard. Eleven real backend tests pass including owner isolation, durable reopen, optimistic conflict, request bounds and secure cookies.
- Security review: auth-body transport initially unbounded; fixed at 16KiB including chunked. Compressed replay headers normalized; real HTTP gzip test passes. Reviewer approved backend and backup script.
- Task 2 running: account_ui owns account UI/sync, App/main/useGame, minimal prior-game finalization helper and optional SetupModal account controls. Existing initial setup must expose login/leaderboard.
- Root preparing GitHub checks and production service; remote npm ci successful, dependency audit zero. Domain tunnel ingress validated, connector not restarted until app ready.
- Task 2 review round 1: found stale browser-cookie account mixing, truncated response acknowledgement failure, and inert conflict controls under existing dialogs. Root adds required expected-account header check to records GET/PUT plus sensitive auth mutations; UI implementer fixes client header/401, response validation and stacked conflict modal.
- Backend owner-binding regression reproduced red then passes; 13 backend tests pass. HTTPS redirect tested against malicious Host and fixed public origin.
- Task 2 complete and approved after two review fix rounds. Final source passes175unit/integration checks;37browser checks pass,3mobile duplicates intentionally skipped. Test-specific client identities preserve real production signup limits.
- Task 3 live: service running as isolated chess-prodigy user, private0600database and backup verified, daily04:15BDTtimer enabled. Existing Cloudflare tunnel route added without changing older hosts. PublicHTTPSauth/archive/restore/logout/privacy checks pass; onlyownedtestaccount removed.
- Public repository created at github.com/clauding-lab/chess-prodigy; final source publication and release workflow in progress.
