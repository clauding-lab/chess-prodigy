# Chess Prodigy

**[Play Chess Prodigy](https://chess.clauding-lab.com)** · [Releases](https://github.com/clauding-lab/chess-prodigy/releases)

A chess coach you can play in your browser. Practise against three engine strengths, explore opening plans, ask for a hint and review your moves. Play as a guest or create an account to keep your progress across devices.

[![Chess Prodigy — dark board, three engine strengths, 185 opening lines, 27 coaching cards, hints and game review, accounts and saved progress, practice leaderboard, and offline guest play](docs/verification/hero-banner.png)](https://chess.clauding-lab.com)

## New in 2.4

**Paul Morphy now follows designed development and attacking plans.** Outside documented positions, he prioritizes bringing new pieces into play, opening the centre when developed and safe, and coordinating more pieces around the enemy king. Endgames use neutral search. A tactical score limit bounds stylistic choices, though it cannot guarantee sound play. These are Morphy-inspired design choices, not a reconstruction of his thought or a claim that he played every move.

The documented repertoire remains unchanged: 247 legally replayed normal games and 6,940 recorded positions, choosing legal recorded moves by their occurrence counts. Familiar openings remain possible. Classic keeps its separate repertoire. See the [historical sources](docs/verification/morphy-history/README.md) and [playing-plan checks](docs/verification/morphy-plans/behaviour-report.md).

Fresh measurement across **400 complete games** gives Casual **1225**, Club **1400** and Strong **1625**. All games and calculations were independently audited. Strong measured lower than the previous version and uses its own measured value. These are strengths relative to Classic within this app, not human or FIDE ratings. See the [measurement and full game evidence](docs/verification/morphy-plans/measurement-report.md).

New Morphy games use this version automatically when Morphy is enabled. There is still one Paul Morphy choice. Saved games and rematches keep their original opponent and fixed rating; the interface identifies earlier versions. Hints and takebacks make games unrated, and old beta games remain unrated. Dark mode remains the default, with a saved Wooden board preference respected.

## Included from 2.3

The earlier historical opponent (version 3, historical-v1) uses the same documented repertoire, followed by preferences learned from Morphy's games. Its fixed ratings remain Casual **1275**, Club **1375**, Strong **1775** for its saved games and rematches. The learned preferences showed a modest prediction improvement on 57 held-out whole games; that result applies to this earlier model. See the [model evaluation](docs/verification/morphy-history/model-report.md) and [earlier 400-game measurement](docs/verification/morphy-history/measurement-report.md).

## Included from 2.2

The app opens on a home screen with an explanation of each opponent and a prominent **Resume game** button beside your saved position. **Classic** is the standard computer opponent; **Paul Morphy** is an attack-and-development simulation inspired by the nineteenth-century American master. Opponent style and difficulty are separate choices.

Starting another game requires **Resume game** or **Forfeit and continue** while a started game is unfinished. The warning shows the exact Practice Rating effect; assisted games remain unrated. Timed games keep counting on Home and while the app is closed. Reopening applies elapsed time and any timeout result once before you can resume. Human matches remain untimed.

## Included from 2.1

The earlier Morphy opponent (version 2, style-v1) retains Casual **1200**, Club **1375**, Strong **1825**, measured across 400 games against Classic. These values continue to apply to its saved games and rematches. They are relative strengths on this app's Practice Rating scale, not FIDE estimates. See the [earlier measurement, uncertainty and evidence](docs/verification/2026-09-12-morphy-calibration.md).

Morphy is enabled on the hosted site. Source builds retain the optional `VITE_PERSONALITY_BETA=true` setting. Existing installed copies offer **Update now** after the active game ends; updates never force a game reload.

## Included from 2.0

- **Games, replay and rematches:** browse up to 200 completed computer games and replay their moves without changing your active game or rating. Rematch keeps the opponent, difficulty, colour and clock settings, with a chance to change them before starting.
- **Private opponent records:** compare retained wins, draws and losses by opponent version and difficulty. Assisted and unassisted games stay separate; older records may have unknown assistance. These counts cover retained games, not lifetime totals.
- **Independent coaching review:** hints and move annotations use a neutral reviewer, separate from the opponent's playing style. Old or incomplete evaluation data is not presented as a trustworthy review.
- **Optional Paul Morphy opponent:** an attack-and-development style at Casual, Club and Strong difficulty. It works for guests without signing in. Enable it in local builds using the command below.
- **Safer saved games:** versioned opponents, recoverable legacy saves and a corrected draw when time expires against an opponent with only a king. Existing Classic ratings and 1v1 play are preserved.

Historical move prediction and playing strength are evaluated separately. The internal benchmark does not establish human tournament strength. Physical-device installation/audio checks remain outstanding.

### Saved games and recovery

Guest history stays in this browser; account records stay with their owner. Opening **Games** does not pause a running clock. Pending account records are labelled when offline, and an unavailable history cache is shown as incomplete.

Damaged history is preserved and offers a download of the original data. If a completed game cannot be saved, starting another game stops with a recovery download. Retain these files for assisted recovery; there is no recovery-file import screen. Signing in does not automatically import guest games.

Version 2.4 uses a new generation of guest/account save locations and preserves older copies for recovery. A damaged current save never silently falls back to an older copy. Pending account changes survive migration. After an account first saves the new Morphy, an enduring minimum client policy blocks incompatible older clients from overwriting its progress, including after assisted games or a practice reset. Rollback requires keeping the new save locations and policy table and using compatible code. Old beta games are never retroactively rated.

Supported saved Morphy games can resume and replay with the beta disabled, but starting a new Morphy game or rematch requires the beta setting. Unknown opponent versions remain read-only with **Download recovery save**; the app never silently substitutes Classic. Older records without a clock setting default to **No clock** for rematches.

## Play a friend

Registered players can open **Play a friend**, choose a colour and share a private invitation link. The recipient signs in or registers and joins automatically. Invitations accept one opponent and expire after seven days. **My games** lists ongoing and completed matches; either player can leave and resume later.

Human games are untimed. Brevo email and optional device push alert the inviter when the opponent joins, then remind the player to move once after ten minutes. Notification preferences live in My games. Push needs permission on each device; iPhone/iPad users must add the app to the Home Screen first. Delivery depends on provider/device availability, with bounded retries and abuse limits.

**1v1 Rating** starts at 1200 and uses Elo with K=32; the first ten games are provisional. Completed results update both players once. **H2H** tracks lifetime wins against each opponent, with draws shown separately. No hints or takebacks during human matches; coaching/review opens after the result. The account menu includes **Edit name**; changing a name preserves all records and ratings.

**Practice Rating** measures performance within this app. It is not an official FIDE rating or an estimate of human tournament strength. Its existing mathematics and history are unchanged; 1v1 has a separate rating and leaderboard tab.

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

From Home, choose **New game** or an opponent's play button, then choose a colour, strength and time control and press **Start**. Use **Resume game** to return to a saved game. Click a piece and its destination, or use the keyboard: Tab enters the board, arrow keys navigate, Enter/Space selects and moves, Escape deselects.

The clock starts after the first move and keeps running on Home and while the page is hidden or closed. Starting another game forfeits an unfinished rated game as a loss. The New game warning shows the rating before and after; choose **Resume game** to return or **Forfeit and continue** to accept the loss. Ratings are displayed as whole numbers and cannot fall below 1400. **Copy FEN** copies the current board position; it is not a full game backup.

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

To enable the optional Paul Morphy beta in the local guest preview (no account required):

```sh
VITE_PERSONALITY_BETA=true npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173`, choose **New game**, then **Paul Morphy**. For a production build with the beta enabled, use `VITE_PERSONALITY_BETA=true npm run build`, then `npm start` or `npm run preview -- --port 4173`. This setting is applied at build time; setting it only when starting an already built server does not enable selection.

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

See [CHANGELOG](CHANGELOG.md), [2.0 release evidence](docs/verification/2026-09-11-v2-release.md), [feature verification](docs/verification/2026-09-11-personality-pwa-run3.md), [historical release evidence](docs/verification/release-report.md), [agent instructions](AGENTS.md) and [scope](VISION.md). There is no Stockfish, paid AI or external chess-service dependency.
