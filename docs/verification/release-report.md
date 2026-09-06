# Chess Prodigy v1.0.0 release verification

## 7 September 2026 BDT — H2H navigation, temporary chat and header

- 219 unit/integration tests pass, including participant-only chat, text/emoji, typing expiry, departure clearing, delayed old-session requests and disconnection cleanup between timer ticks. Typecheck, lint, formatting and production build pass.
- Full browser run: 45 passed, three intentional mobile skips, and two failures from the old title selector. Both failed checks pass after updating the selector to the new header. Both offline-reopen checks passed in this run; this does not establish the cause of the earlier intermittent CI failure.
- Desktop/mobile journeys verify delivery, literal rendering of HTML-like text, typing, chat erasure after either participant leaves, and an empty transcript on returning. H2H eligibility refreshes on both the board and My games. Selected WCAG axe checks and overflow checks pass.
- Chat and header visually inspected at mobile size; shared practice header is exercised in both themes. Existing knight assets and local serif fonts preserve offline availability.
- Code and security reviews completed. New-message scrolling follows message identity at the 100-message cap; server presence expires at 25 seconds, leaving margin for cleanup and recipient polling. UI describes an approximate 30-second disconnection interval.
- Chat is volatile process memory only. No schema migration or notification delivery changes. Application shutdown clears the store and timer; server restart loses all chat. Prior player records and ratings remain unchanged.

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

- Owner reported physical phone verification passed on 5 September 2026 BDT. Device model, operating system and installation-specific results were not separately recorded; this is owner-reported use, not a claim that both Android and iOS were independently tested.
- Email is an unverified login identifier; automated email recovery is unavailable. Password changes require a signed-in session.
- Practice ratings are not independently verified competitive scores.
- Account history retains 200 completed games. Guest history is not automatically imported. Use one playing tab at a time; conflicts are detected rather than live-mirrored.
- Daily consistent backups are on the same server. Off-server disaster recovery remains unconfigured.

## Live HTTPS verification

Verified at **chess.clauding-lab.com on 5 September 2026 BDT**: registration with a disposable test account, legal play/resignation, a private archived game, confirmed account save, restore in an independent browser context, logout and public leaderboard field privacy. The owned test account and its records were removed after verification; no sample players were seeded into the public leaderboard.

HTTP redirects to the fixed HTTPS address. Unauthenticated private-record requests return 401 with no-store headers. The isolated service is active, and its first consistent database backup succeeded with private 0600 file permissions. The daily timer is enabled for approximately 04:15 BDT.

Live v1.0.1 screenshots: [desktop dark](public-desktop.png), [mobile dark](public-mobile.png). Owner subsequently reported successful phone verification on 5 September 2026 BDT.

## v1.0.1 — dark default and neutral accents

New guest and account sessions default to the dark board; previously saved theme choices remain valid. Green controls, highlights, positive markers and icon backgrounds have been replaced with muted gold, warm brown or slate. Startup and installed-app colours match the dark default.

Verified: 175 unit/integration tests, 37 browser checks (3 duplicate mobile cases skipped), typecheck/lint/format/build, and Lighthouse accessibility **100/100 for both themes**. Default dark and explicitly saved wooden preferences are covered by the existing reload tests. The public screenshots show the updated dark appearance.

## v1.1.0 — patient movement and richer coaching

Verified on 5 September 2026 BDT:

- **183 unit/integration tests** across 18 files; typecheck, lint, formatting and production build pass.
- **41 browser checks pass**, with 3 deliberate duplicate-mobile skips. Coverage includes real piece movement, reduced motion, earlier coaching stories through play, saved-game reload and new-game clearing.
- Lighthouse accessibility **100/100 in both themes**. The expanded opening story additionally has no WCAG 2 A/AA or WCAG 2.1 AA violations in axe checks in either theme. An unrestricted supplemental axe scan reports the existing page-heading/landmark best-practice suggestions outside that WCAG scope.
- Castling animates both pieces. Unit checks cover the one-second minimum reply, no extra wait for a longer calculation, cancellation on undo/resignation/new game, and animation cancellation on unmount. Existing elapsed-time and timeout checks remain passing.
- All 185 preserved opening lines resolve to one of **37 opening-family contexts**. All **27 motif categories** have expanded sourced lessons. Original opening/motif source records remain unchanged. See [editorial scope](coaching-sources.md).
- Desktop coach reading is height-bounded and scrollable; phone reading uses page scrolling. [Desktop reading](desktop-coaching.png) and [phone reading](mobile-coaching.png) were visually inspected.
- White knight icons use the charcoal background. Manifest icons return HTTP 200 with correct 192/512 dimensions; browser and Apple icons reference the new `knight-*` filenames.
- Independent code review approved timing, animation, history, icon references and the account test correction. TypeScript review found no lifecycle defect; the intentional displayed-prose replacement is recorded in VISION.md.

The prior failing GitHub run **33976332941** was investigated using its downloaded
trace: `guestBefore` was `null` before asynchronous account/guest initialization,
while the post-signout value was a fresh empty guest session. Adding 400 ms of
account-lookup latency reproduced that exact failure on a disposable local
database. The test now waits for the setup dialog and initialized guest save before
taking its baseline. The strict full-save equality assertion is unchanged, and the
full browser suite passes with that latency retained. Production account/storage
code was not changed for this test race.

## v1.2.0 — friend matches, notifications, ratings, and sound

Verified on 6 September 2026 BDT:

- 212 unit/integration tests across 23 files, including isolated real SQLite/auth flows, atomic 1v1 Elo/H2H completion, invite races, current-turn reminders, retry/restart handling, device ownership cleanup, and audio activation/cancellation.
- Source typecheck, lint, formatting and production build pass. Staged-source Gitleaks scan found no secrets.
- Desktop and mobile journeys cover invite→registration→join, both players moving, a deliberately delayed 3.5-second move across polling, reload, resignation, rating/H2H and name changes. A separate browser regression blocks account entry if the previous account's push subscription cannot be cancelled.
- The friend board has zero selected WCAG 2 A/AA and 2.1 AA axe violations and no horizontal overflow at desktop/mobile sizes. Lighthouse scores 100 in both existing themes. Screenshots: [desktop 1v1](multiplayer-desktop.png), [mobile 1v1](multiplayer-mobile.png).
- Browser Web Audio measurement observes a real waveform when sound is enabled and no subsequent move waveform after muting, in desktop and mobile-sized Chrome. This is not evidence of physical phone-speaker audibility.
- Independent code, TypeScript and notification security reviews found no outstanding actionable issues after fixes for background timed-computer play, push account switching, polling continuation, invitation identity, draw-offer persistence and expired-invitation sorting.

The local server tests initially returned impossible 501/non-HTTP responses. A controlled experiment reproduced an IPv6 wildcard listener sharing a numeric port with an unrelated explicit IPv4 service on macOS: the IPv4 request reached the unrelated service. Test fixtures now bind persistent listeners explicitly to 127.0.0.1 and await cleanup. A binding regression catches the old behavior. Production routes and request limits were not changed to accommodate tests.

Notification delivery uses private Brevo and VAPID settings. Provider acceptance does not guarantee inbox/device delivery. Browser push permission and physical-device delivery require enabling alerts on the device; emulation does not establish that. Email remains an unverified login identifier and password recovery is unchanged. Daily sending/retry limits are documented in the deployment runbook. The app does not issue official FIDE ratings.

Final full browser suite: **47 passed**, with three deliberately skipped duplicate-mobile cases. Production dependency audit: zero known vulnerabilities.

### Live deployment

Release **v1.2.0**, code commit `413cbab29f469d3a8959a60e3294d32e7bed724d`, is deployed at https://chess.clauding-lab.com. GitHub verification and secret-scan jobs passed in [run 34043952499](https://github.com/clauding-lab/chess-prodigy/actions/runs/34043952499). The Linux target independently passed 212 tests, typecheck and production build before switching the release symlink. Database backup completed successfully first; the prior v1.1.0 release is retained.

Live verification covered two owned test accounts, invitation acceptance after login, moves from both sides, reload, and notification configuration. The durable game-start email job reached `sent` after Brevo accepted the request. That proves provider acceptance, not inbox receipt. Device push is configured; actual delivery to a physical device awaits that device's explicit opt-in. Both owned test accounts and their single match were removed in a guarded transaction after verification; no real player records were changed. No ten-minute wait or clock manipulation was performed against production.
