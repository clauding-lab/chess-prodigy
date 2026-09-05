# Chess Prodigy v1.0.0 release verification

The public-release scope includes named email/password accounts, private records, synchronized progress and a public name/practice-rating leaderboard. It builds on the [verified local chess candidate](local-candidate-report.md).

## Account and security checks

- Real registration, password-hash storage, sign-in/out, bounded names/passwords, production Secure/HttpOnly/SameSite cookies.
- Authenticated owner isolation, expected-account identity checks against stale browser cookies, atomic optimistic-version conflicts, idempotent game records, persisted database reopen and bounded request rates.
- Auth body limits before parsing, including oversized declared/chunked input. Normal compressed requests retain correct decoded length.
- Fixed-origin HTTP-to-HTTPS redirect, HSTS, content-security policy and no-store API responses.
- Leaderboard projection contains only rank, display name, practice rating and rated-game count; eligibility requires a rated game. Private email and per-game snapshots are excluded.
- Secret scan before publication; environment files, SQLite databases and machine logs are ignored by Git.

## Browser and synchronization checks

The release adds real full-stack browser journeys on desktop and mobile layouts for registration, play/resignation, server save, independent-context restore, private history, logout/guest isolation and leaderboard visibility. Pending account changes retain their base version and terminal-game transitions across offline reloads. The original chess/offline/worker/update journeys remain required.

Review hardening additionally covers account switching in another tab, truncated server responses, explicit reauthentication and conflict choices while a game dialog is open.

## Final automated results — 5 September 2026 BDT

| Check | Result |
| --- | --- |
| Frontend + server TypeScript | Pass |
| ESLint | Pass, no warnings |
| Formatting | Pass |
| Unit and integration suite | **175 passed in 17 files** |
| Production build | Pass; app 269.42 kB / 89.52 kB gzip; worker 9.19 kB |
| Desktop + mobile browser suite | **37 passed; 3 duplicate mobile cases intentionally skipped** |
| Secret scan | Gitleaks: no secrets found in staged source |
| Dependency audit | 0 known vulnerabilities |
| Target-server install/typecheck | Pass on Linux x64, Node 22 |

The first complete browser run reached the real five-registration quota because independent tests shared an IP. Fixtures now model separate client identities on the disposable local server; production limits remain enabled. The full browser rerun passes. The account restore test waits for confirmed cloud save rather than a fixed sleep.

Independent security and TypeScript reviews approved the final source after fixes for bounded auth transport, decoded body headers, stale account identities, interrupted responses, dialog stacking and saving preferences back to their initial value.

Machine-generated logs remain local and are excluded from the public repository. [GitHub Actions](https://github.com/clauding-lab/chess-prodigy/actions) repeats the automated checks on pushes and pull requests.

## Remaining limitations

- Physical Android/iOS installation and performance remain unverified; mobile emulation is not a real device.
- Email is an unverified login identifier; automated email recovery is unavailable. Password changes require a signed-in session.
- Practice ratings are not independently verified competitive scores.
- Account history retains 200 completed games. Guest history is not automatically imported. Use one playing tab at a time; conflicts are detected rather than live-mirrored.
- Daily consistent backups are on the same server. Off-server disaster recovery remains unconfigured.

## Live HTTPS verification

Verified at **chess.clauding-lab.com on 5 September 2026 BDT**: registration with a disposable test account, legal play/resignation, a private archived game, confirmed account save, restore in an independent browser context, logout and public leaderboard field privacy. The owned test account and its records were removed after verification; no sample players were seeded into the public leaderboard.

HTTP redirects to the fixed HTTPS address. Unauthenticated private-record requests return 401 with no-store headers. The isolated service is active, and its first consistent database backup succeeded with private 0600 file permissions. The daily timer is enabled for approximately 04:15 BDT.

Live screenshots: [desktop wood](public-desktop.png), [mobile dark](public-mobile.png). Physical phone verification remains pending.
