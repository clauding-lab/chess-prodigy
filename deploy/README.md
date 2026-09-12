# Hosting and database operations

The application serves both its built frontend and account API on one origin. Production is https://chess.clauding-lab.com. Node binds to loopback port 4317; a Cloudflare Tunnel forwards the hostname to that port. Do not expose the origin port publicly.

## Configuration

| Variable | Meaning |
| --- | --- |
| `BASE_URL` | Exact public origin, including HTTPS; locally `http://127.0.0.1:4317` |
| `PORT` | Loopback HTTP port; default 4317 |
| `DATABASE_PATH` | SQLite database path; keep outside release code |
| `AUTH_SECRET` | Random persistent secret, at least 32 characters |
| `NODE_ENV` | `production` on the server |

Generate a secret with `openssl rand -hex 48`. Store it only in the protected environment file; do not paste it into a terminal command argument, commit it, or regenerate it on each release. The application refuses to start without a usable secret. Local `npm start` reads `.env`; systemd injects `/etc/chess-prodigy.env` (root-owned, mode 0600).

For local frontend work, build once and start the server on 4317. Run `npm run dev` for the Vite frontend. Authentication must use the origin configured in `BASE_URL`; when using the frontend development address, set `BASE_URL=http://127.0.0.1:5173` and restart the API. Vite proxies `/api` to port 4317. The default frontend-only mode still permits guest play.

## Layout and service

- `/opt/chess-prodigy/releases/<release>`: immutable code and built frontend, installed with `npm ci` on the target OS. Do not copy macOS `node_modules` to Linux.
- `/opt/chess-prodigy/current`: symlink to the active release.
- `/var/lib/chess-prodigy/chess.sqlite`: private database, owned by the isolated `chess-prodigy` service account. Parent mode 0700.
- `/etc/chess-prodigy.env`: root-owned configuration and secret, mode 0600.
- `chess-prodigy.service`: starts the app as its own unprivileged user, with code read-only and database directory writable.

Install the service unit from this directory into `/etc/systemd/system/`, run `systemctl daemon-reload`, then `systemctl enable --now chess-prodigy`. The service expects Node at `/usr/bin/node` and installed `tsx` in the release. Production installs currently include development dependencies because the service runs TypeScript directly.

Add a tunnel ingress entry **before its catch-all**:

```yaml
- hostname: chess.clauding-lab.com
  service: http://127.0.0.1:4317
```

Preserve all existing hostname routes. Validate the tunnel configuration, create the hostname's DNS route using the tunnel credentials, then restart the tunnel connector. Do not disable authentication on unrelated hostnames. This app's hostname is public; private record routes authenticate their own users.

## Verify and update

Check `/api/health`, an actual guest game, registration/login/logout, account restore and `/api/leaderboard` over HTTPS. API responses must have `Cache-Control: no-store`; private paths must not be service-worker-cached. Check `systemctl status chess-prodigy` and recent journal errors without printing user records or secrets.

Build and test each release before switching `current`. Back up the database first, install the new directory, switch the symlink, restart only `chess-prodigy`, then verify HTTPS. Keep the previous release for rollback. Better Auth's schema migrations run during startup. Do not roll back across an incompatible schema migration without a reviewed database recovery plan.

## Backups and recovery

Install `chess-prodigy-backup.service` and `.timer`, then enable the timer. It runs at approximately **04:15 BDT** daily and retains the latest 14 copies under `/var/lib/chess-prodigy/backups`. `backup.mjs` uses SQLite's consistent online backup API, including committed write-ahead-log contents. Copying only the live `.sqlite` file can miss recent writes.

These are local recovery copies, not off-server disaster recovery. Copy backups to a separately secured destination when one is provisioned; they contain private data and must never enter Git or public file storage.

Before a release, run `systemctl start chess-prodigy-backup` and confirm success. To restore, an operator must stop the app, preserve the current database and its `-wal`/`-shm` companions in a protected recovery folder, place the selected backup at `DATABASE_PATH` with owner `chess-prodigy` and mode 0600, then restart and verify. Restoring discards writes newer than the backup, so choose the restore point deliberately. Do not copy stale WAL files alongside a restored backup.

## Account limitations

Email addresses are unverified login identifiers. No email sender or automated forgotten-password recovery is configured. Do not reset a password based only on someone claiming an email address. Users can change their password while authenticated. Public leaderboard fields are display name, practice rating and rated-game count; email and individual games remain private. Ratings are personal practice metrics and are not cheat-proof competitive scores.

## Multiplayer notification configuration

v1.2.0 adds private `mp_*` and `notification_*` tables on startup. These are additive; a rollback to 1.1.0 leaves multiplayer records intact but temporarily hides the feature and stops alerts. Never restore an older database merely to roll back code: that would discard new games.

Set in `/etc/chess-prodigy.env`, outside release directories:

- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME` (Chess Prodigy).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a sender contact URL or mailto address).

Generate push keys once with `web-push.generateVAPIDKeys()` and preserve them across releases. Rotating them requires devices to subscribe again. Missing channel configuration disables that channel and is reported honestly in My games. The active sender and Brevo account must have available sending capacity; shared account limits also cover other projects. No paid upgrade is automatic.

The worker scans every 15 seconds; reminders are eligible after ten minutes. Delivery gets four bounded attempts; old-turn reminders are discarded before dispatch. Limits are 20 email attempts/address/day and 250/day from this app. Provider acceptance is not proof of inbox delivery. A crash after external acceptance can produce a duplicate retry; no exactly-once external-delivery guarantee is made. A notification already handed to a provider cannot be recalled after a move.

Check aggregate `notification_jobs` counts grouped by status for pending/sent/failed/limited jobs. Do not print recipient or subscription records in public logs. Push opt-in is per device. Expired subscriptions are deleted on provider 404/410; account switching unsubscribes mismatched device ownership before showing the new account.

## Rated Morphy — v2.1

Build hosted releases with `VITE_PERSONALITY_BETA=true`; the source default remains off. The new `record_client_policy` table is additive and records which accounts require measured-rating client support. Preserve it permanently, including after a practice reset. Browser saves now use state-v3/account-v3/history-v2 keys with older keys retained for recovery. Rollback must retain all new data and use code that understands measured Morphy version 2; simply restoring v2.0 code after rated games is unsafe. See the dated calibration report for fixed strengths and verification evidence.
