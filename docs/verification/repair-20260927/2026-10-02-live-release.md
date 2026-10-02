# v2.6.1 live release — 2 October 2026 BDT

The owner answered “do it” to the explicit offer to publish and deploy the verified repair-only
candidate. Source `6b8a009d36b6a84830f021143206ce018d77ac1d` was fast-forward pushed to main,
published as [v2.6.1](https://github.com/clauding-lab/chess-prodigy/releases/tag/v2.6.1) and installed at
`/opt/chess-prodigy/releases/2.6.1-20261002-6b8a009`. The existing hostname is unchanged.

## Deployment evidence

- Linux Node22.22.2; locked dependencies installed with npm ci on the target, not copied from macOS.
- Exact tested frontend archive SHA-256 matched on the server:
  `49e726e6d349c6f318d39d755d4d043e9bc583260cbbb7031e19824a1c353870`.
- Private manual backup completed with SQLite integrity validation at **21:53:12 BDT**. Database,
  secrets and ownership were preserved; no player records were printed or used for tests.
- Retained seven old and eight new immutable public assets before switching, with no deletions.
  `ASSET_ARCHIVE_PATH` and loopback-only `TRUST_LOCAL_CLOUDFLARE_TUNNEL` were configured.
- Updated the backup service to use `BACKUP_KIND=daily`; its existing timer remains enabled.
- Switched the current symlink and restarted only chess-prodigy. Initial startup briefly refused
  connections while initializing, then health passed. Service active/running, zero automatic restarts,
  no error-priority journal entries in the inspected interval.
- Public HTTPS health and leaderboard endpoints returned200 with `Cache-Control: no-store`.
  The retained old `index-D4KbtQ7g.js` still returned200. New HTML references `index-DhVay7Mg.js`.

## Live guest browser evidence

An isolated browser opened the old release before cutover. Its Tal version1 game continued after
cutover. The installed update waited during active play. After resigning this synthetic guest game,
explicit Update now loaded the new bundle and migrated v7 to v9, preserving game identity, opponent,
full rating receipt and the older recovery key.

A separate fresh browser context selected Fischer Casual1250, played e4, received a legal reply,
and saved compact wire3 under state-v9 with Fischer/version1/fischer-plans-v1. Reload and Resume
retained the same game, moves, opponent and rating. Dark theme remained the default. No accounts
were created and no real player progress was changed by verification.

Local release checks and their retained logs remain in [the candidate report](repair-only-release.md).
Phone and blind-play checks are owner-waived; actual screen-reader behavior remains unverified.
The unsuccessful engine experiment remains unavailable to new games. This is a reliability release,
not a claim of stronger play. After compact writes, recover with compatible forward fixes; never
roll back to v2.6.0 or restore an older database merely to reverse this code release.
