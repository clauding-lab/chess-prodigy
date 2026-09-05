# Chess Prodigy accounts and public release

Owner request, 5 September 2026 BDT: add name/email login, retain user records, host at chess.clauding-lab.com, publish a public GitHub repository with README and release notes. Explicit autonomous build/publication authorization supersedes former local-only boundaries.

## Design

Keep the chess engine, 185 opening lines, 27 coaching cards, themes and practice-rating policy unchanged. Guest play remains available offline. Add a private account service on the existing server, reached over HTTPS through its existing Cloudflare Tunnel. A separate Linux service account owns the database. No additional paid services.

Choose Better Auth with SQLite and Express for maintained password/session handling on the existing server. Alternatives: email codes need a delivery provider that is not configured; a hosted auth/database service adds another account and operational dependency. Default to name + email + password after the optional preference question; email is an account identifier, not verified ownership. No claim of verified email, email recovery or email delivery. Allow password changes while signed in; explain unavailable forgotten-password recovery before registration.

## Records and synchronization

Account fields: private name, email, registration date and last activity. Each account owns a validated game/rating/preferences snapshot and completed-game records. Records include result, opponent level, player colour, rated status, moves and completion date. Ratings are personal practice measurements, never official FIDE ratings or a cheat-proof leaderboard.

Guest storage stays under its existing key. Signed-in storage uses an opaque user-ID namespace and never imports guest records automatically. Load remote state before mounting account gameplay. Save local state immediately; send serialized updates in order. The server requires expected version for each write, returning 409 on conflict. Never automatically overwrite a different device's progress; present explicit reload-cloud or keep-this-device resolution. Offline changes retain their base version and pending state; retries and reloads preserve that information. Authentication failure blocks sync and asks for sign-in. Account switches remount gameplay and invalidate all outstanding requests. No personal API response enters the offline cache.

Completed-game records are idempotent by user/game ID. Undo of the latest result removes its archived result; a subsequent result updates it. Retain older completed games when starting a new one. Data comes from validated browser play; it is not independently competitive verification. API input is bounded and legally replayed with the existing parser. Private queries always derive user ID from the authenticated session, never client input.

## Security and operations

Better Auth handles salted password hashing and HttpOnly session cookies; production cookies Secure and SameSite=Lax. Require same-origin requests for mutations, narrow trusted origin, rate limits on authentication and records, strict JSON/body limits, no wildcard CORS and no secrets in logs. Auth routes precede JSON parsing. Database and secret live outside release code, restrictive permissions, daily consistent backups and a documented restore procedure. Frontend/backend same origin, service binds loopback only. Health endpoint exposes no personal data. Publish source only after secret/private-data scan; exclude environment, databases, backups, generated local verification logs and agent scratch material.

## Acceptance

Real registration, login, logout, rejected invalid credentials; two users cannot read/write each other's records; repeat submissions don't duplicate games; stale writes rejected; reload and second-device restore; account/guest isolation; offline guest unchanged; no cache of private API; authenticated state persists server restart. Typecheck, lint, unit/integration/browser checks, production build, live HTTPS smoke and GitHub CI pass. README includes live URL, setup, scripts, data/recovery limits and deployment; CHANGELOG and GitHub v1.0.0 release describe actual delivered behavior. Physical-device checks remain pending.

## Owner addition: leaderboard

The owner explicitly added an in-app rating leaderboard during implementation. This supersedes the earlier no-leaderboard boundary. Public leaderboard fields are player display name, practice rating and rated-game count only. Email, identifiers and individual game records remain private. Registration must disclose name/rating visibility before account creation. Show the top 100 accounts that have at least one rated game; sort by rating descending, rated games descending and stable ID. Expose GET `/api/leaderboard` as `{players:[{rank,name,rating,games}]}`. Reset/undo affects current eligibility/rating. Label as practice ratings, not competitive verification. Tests cover eligibility, sorting and no email/IDs leakage; UI handles loading, empty and retry states.

## Review hardening: account binding

Every records GET/PUT includes `X-Chess-Account` with the client’s expected account ID. The server compares it to the real authenticated session and returns 401 on absence/mismatch before reading or saving. It still derives ownership only from the authenticated session. This prevents an old tab from copying records into a different account after another tab changes the cookie. Account-specific password changes and sign-out also send the identity header and reject mismatches. Authentication failures are actionable and never create a substitute fresh cloud snapshot.
