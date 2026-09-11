# Chess Prodigy

**[Play Chess Prodigy](https://chess.clauding-lab.com)** · [Releases](https://github.com/clauding-lab/chess-prodigy/releases)

A chess coach you can play in your browser. Practise against three engine strengths, explore opening plans, ask for a hint and review your moves. Play as a guest or create an account to keep your progress across devices.

[![Chess Prodigy — dark board, three engine strengths, 185 opening lines, 27 coaching cards, hints and game review, accounts and saved progress, practice leaderboard, and offline guest play](docs/verification/hero-banner.png)](https://chess.clauding-lab.com)

## Play a friend

Registered players can open **Play a friend**, choose a colour and share a private invitation link. The recipient signs in or registers and joins automatically. Invitations accept one opponent and expire after seven days. **My games** lists ongoing and completed matches; either player can leave and resume later.

Human games are untimed. Brevo email and optional device push alert the inviter when the opponent joins, then remind the player to move once after ten minutes. Notification preferences live in My games. Push needs permission on each device; iPhone/iPad users must add the app to the Home Screen first. Delivery depends on provider/device availability, with bounded retries and abuse limits.

**1v1 Rating** starts at 1200 and uses Elo with K=32; the first ten games are provisional. Completed results update both players once. **H2H** tracks lifetime wins against each opponent, with draws shown separately. No hints or takebacks during human matches; coaching/review opens after the result. The account menu includes **Edit name**; changing a name preserves all records and ratings.

**Practice Rating** measures performance within this app. It is neither an official FIDE rating nor a calibrated estimate. Its existing mathematics and history are unchanged; 1v1 has a separate rating and leaderboard tab.

Local personality beta (not released): new Paul Morphy selection is **off by default**.
Use `VITE_PERSONALITY_BETA=true npm run dev -- --port 5173`, or
`VITE_PERSONALITY_BETA=true npm run build` followed by the normal preview command.
Select **Paul Morphy**, difficulty, colour and time in New game. “Attack & development”
describes the bounded playing style; every beta game is unrated while calibration is pending.
Existing supported beta games resume with the flag off. Unknown opponent versions remain
read-only and offer **Download recovery save**; retain that copy before applying an update.
There is no recovery-file import UI in this run; retain it for a compatible client or local
restoration with assistance.

Local Run 3 adds **Games** within computer practice: up to 200 completed games, private recorded
results by opponent version and difficulty, and read-only move replay. Guest history stays in this
browser; account records stay with their owner. Assisted and unassisted results are shown separately;
older records may have unknown assistance. These are retained records, not lifetime totals.
Opening Games does not pause a running clock. Replay changes neither the active game nor its rating.

After a result, **Rematch** opens the existing setup with opponent, difficulty, colour and clock
retained. You can change the colour before starting; starting creates a new game identity and beta
seed. Older records without a clock setting explicitly default to No clock. New Morphy rematches
require the beta switch; saved games and legal replays remain accessible when it is off.

Guest history uses the separate `chess-prodigy-guest-history-v1` key. Account history is a local
cache of server records plus pending changes, outside the active snapshot. Offline pending records
are labelled; missing caches are incomplete. Damaged history is preserved and offers an original
history download. If a completed game cannot be preserved, starting another game stops with a
recovery download; retry saving or retain the files for assisted recovery. There is no recovery-file
import UI. No SQL migration, automatic guest import or retroactive rating change is introduced.
Run 3 [plan](docs/plans/2026-09-11-personality-pwa-run3.md) and
[verification](docs/verification/2026-09-11-personality-pwa-run3.md) contain checkpoint status.
After building, `npm run test:browser -- tests/browser/records.spec.ts` exercises these flows with
synthetic guest data and the disposable account server. Use the same beta switch for build and test
when checking enabled Morphy rematches.

Saves use version 2 with versioned opponent configuration and seed. Legacy saves become Classic;
original v1 guest/account keys remain untouched for recovery. A present unreadable v2 save
never falls back to v1. Migrated account queues preserve ordering and must be stored before
sending. Once the server accepts v2 it rejects v1 writes, including writes with the current
version counter. A rollback to v1-only code cannot sync these saves; preserve v2 data and
restore compatible code. No deployment or data rewrite is required for these local checks.

Run 2 evidence and exact checkpoint status: [plan](docs/plans/2026-09-11-personality-pwa-run2.md)
and [verification](docs/verification/2026-09-11-personality-pwa-run2.md). For native beta journeys,
run `npm run test:browser -- tests/browser/personality.spec.ts` after a normal build, or prefix
both build and that test command with `VITE_PERSONALITY_BETA=true` to verify enabled selection.
These tests use synthetic guest data and a disposable account server. No playing strength,
historical fidelity, naming clearance or physical-device verification is claimed.

After your first completed 1v1 game, **H2H** appears in the top bar. Open it to see each opponent and your lifetime wins, draws and losses. Both participants can see their shared results; other players cannot access that matchup's history.

The match screen includes private **Chat**, with an animated typing indicator. The top Chat button shows a gently pulsing dot for unread opponent messages while the conversation is offscreen; tap it to jump to the messages. Reading the visible chat clears the dot, and reduced-motion settings keep it steady. Chat is temporary: leaving the match clears it for both players. Abrupt tab closures or lost connections clear after about 30 seconds. Messages are held only in server memory, never in saved games, database backups or browser storage, and disappear on a server restart. Images and attachments are not supported.

## Features

- Custom chess engine with Casual, Club and Strong levels; calculations run separately so the board stays responsive.
- 185 opening lines and 27 coaching cards, move explanations, hints and game review.
- Richer opening and move stories with historical connections, counterplay and further-reading links. Earlier move stories stay in a scrollable coaching history and return with the saved game.
- A one-second minimum engine reply time and smooth piece movement, with reduced-motion support.
- Untimed games or 5, 10 and 15+10 minute clocks, with promotion, castling, en passant and draw detection.
- Dark board by default, an optional wooden board, keyboard controls, sound and mobile layouts.
- White knight app icon on the dark charcoal background.
- Optional name, email and password accounts with private game records, saved position, practice rating and preferences.
- An in-app leaderboard of player names and practice ratings, after one rated game.
- Guest play works offline after the first successful online load. Updates wait until the active game finishes.

## Accounts and privacy

Create an account from **Sign in**. Use an email address as your login ID and a password of 12–128 characters. Email addresses are not verified and automated forgotten-password recovery is not available; keep your password in a password manager. You can change it while signed in.

Email addresses, game records and password hashes are stored privately on the server. Display names, both app rating categories and game counts appear on public leaderboards; individual matches and H2H histories remain private to their participants. Passwords are hashed by Better Auth; they are never stored as readable text. Session cookies are inaccessible to page scripts. The public repository contains source code, not the live database, secrets or player records.

Guest saves and account saves are separate. Signing in does not automatically import or replace a guest game. Accounts retain the most recent 200 completed games. Account progress saves locally first and then synchronizes with the server. If another device has newer progress, the app asks which copy to keep. Watch the save status before switching devices. Login and synchronization require an internet connection.

The rating is a **personal practice rating**, not an official FIDE rating. Hints and takebacks make a game unrated. The server validates saved chess positions but these are not competitive or cheat-proof records. The in-app leaderboard shows display names and practice ratings after at least one rated game. Email addresses and individual game records stay private.

## Play

Choose a colour, strength and time control, then **Start**. Click a piece and its destination, or use the keyboard: Tab enters the board, arrow keys navigate, Enter/Space selects and moves, Escape deselects.

The clock starts after the first move and keeps running while the page is hidden or closed. Starting another game abandons an unfinished rated game as a loss. The New game warning shows the rating before and after; choose **Keep playing** to return or **Abandon and start** to accept the loss. Ratings are displayed as whole numbers and cannot fall below 1400. **Copy FEN** copies the current board position; it is not a full game backup.

Expand a move under **Moves & ideas** to read its story without closing the opening explanation. The stories illustrate recognized chess ideas; they do not claim every move is sound or reproduce a famous game. Story text works offline; external reading links need a connection. See the [editorial scope and sources](docs/verification/coaching-sources.md).

Clearing browser data removes local guest progress and unsynchronized changes. An unreadable save is preserved until you explicitly choose **Enable saving** to replace it. For computer practice, use one playing tab at a time; conflicting saves are detected. Human matches refresh automatically from the server and reject outdated moves.

## Run locally

Requirements: Node 22.19+ and npm. `.nvmrc` selects the tested version.

```sh
git clone https://github.com/clauding-lab/chess-prodigy.git
cd chess-prodigy
nvm use
npm ci
cp .env.example .env
# Set a random AUTH_SECRET in .env; do not commit it.
npm run build
npm start
```

Open `http://127.0.0.1:4317`. The server creates its SQLite database on first start. For frontend development, run the server and `npm run dev` in separate terminals; see [deployment and configuration](deploy/README.md).

For a frontend-only guest preview:

```sh
npm run dev -- --port 5173
```

Offline installation needs HTTPS or localhost. Account requests are excluded from the offline cache.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:browser
```

The browser suite exercises desktop and mobile layouts in Chromium. Physical Android/iOS installation and performance checks remain pending; browser emulation does not establish those results. The separate `npm run test:accessibility` runs Lighthouse against a preview on port 4173 (`CHESS_PREVIEW_URL` overrides the address).

After building, `npx playwright test --config playwright.offline.config.ts` checks cached
Classic/Morphy play, review, completion and recorded-game replay in Chrome and WebKit while each
test's disposable local server is stopped. It verifies that uncached requests fail and that disabling the service worker prevents
reopening. No live server or player data is used. This tests an unreachable app server, not device
airplane mode or OS process eviction. The installed WebKit/Playwright simulated-offline switch
fails cached navigation even for an independent minimal page; the original and current app builds
both pass with the server actually stopped. Existing simulated-offline checks are retained.
See the [investigation evidence](docs/verification/2026-09-11-webkit-offline.md) for exact versions,
reproduction results and remaining physical-device limits.

## Project map

| Path | Purpose |
| --- | --- |
| `src/engine`, `src/worker` | Chess rules, evaluation and background search |
| `src/book`, `src/coach` | Opening lines and coaching content |
| `src/game`, `src/rating`, `src/storage` | Game transitions, practice rating and validated saves |
| `src/account`, `server` | Account interface, private records and synchronization |
| `src/ui`, `src/App.tsx` | Board and application interface |
| `tests` | Logic, account integration and browser regressions |
| `deploy` | Service configuration, backup and deployment guide |
| `reference` | Original supplied prototype and corrected behavioural reference |

See [CHANGELOG](CHANGELOG.md), [release evidence](docs/verification/release-report.md), [agent instructions](AGENTS.md) and [scope](VISION.md). There is no Stockfish, paid AI or external chess-service dependency.
