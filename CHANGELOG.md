# Changelog

## Updates — 2026-09-08 (BDT)

- New-game warning previews the displayed practice-rating loss before replacing an unfinished rated game, with explicit “Abandon and start” and “Keep playing” choices. The 1400 minimum and existing rating rules are unchanged.

## Updates — 2026-09-07 (BDT)

- H2H tab for signed-in players after their first completed human match, with lifetime participant-only results.
- Temporary text/emoji chat in human matches, animated typing indicators, and automatic clearing when either player leaves or loses presence. No saved transcript or attachments.
- Existing knight logo and centered serif title in both game modes.
- Removed game-count columns from both leaderboard tabs.
- Top Chat shortcut with a pulsing unread dot when an opponent's message arrives offscreen; tapping opens chat. Reduced-motion preferences keep the dot steady.
- Removed emoji from the chat placeholder and introductory wording; players can still send emoji.
- Audio activation uses completed taps, and fresh gestures can retry while an earlier browser audio request is blocked.

## [1.2.0] — 2026-09-06 (BDT)

- Registered-player invitation links, resumable untimed 1v1 games, private match lists, resignation and agreed draws.
- Separate 1v1 Elo, lifetime H2H win/draw scores, two leaderboard categories and account name editing.
- Practice heading renamed FIDE Rating with a permanent unofficial computer-practice qualifier; calculation unchanged.
- Brevo game-start emails and one reminder per overdue turn, plus optional device push notifications. Private durable jobs survive restarts; stale reminders are discarded.
- Push subscriptions are detached before account changes, including expired sessions and guest reloads.
- Audio activation waits for browser permission; enabling sound plays a test tone, and muting cancels pending sounds.


## [1.1.0] — 2026-09-05 (BDT)

- Engine replies take at least one second, with a gentle 350-millisecond piece slide. Castling moves both pieces; reduced-motion preferences disable the slide.
- Expanded opening-family histories and all 27 move-idea lessons include historical connections, practical plans, counterplay and further-reading links.
- Coaching history retains earlier move stories throughout the game and reconstructs them from the saved game on reopening. Cards expand independently; the opening starts expanded.
- New white knight icon on the charcoal dark-mode background, including browser and installed-app icons.
- Corrected an automated account-isolation test that sampled the guest save before initialization. A delayed-start regression preserves the strict before/after comparison.
- Owner reported successful physical phone verification; device and installation details were not separately recorded.

## [1.0.1] — 2026-09-05 (BDT)

- Dark board is now the default for new guest and account sessions. Saved theme choices are preserved.
- Replaced green accents with muted gold on the dark board and warm brown on the wooden board; win markers use slate.
- Updated the app icons, loading screen and installed-app colours to match.

## [1.0.0] — 2026-09-05 (BDT)

First public release of Chess Prodigy.

### Added

- Browser chess with Casual, Club and Strong engine levels, full legal move handling and elapsed-time clocks.
- 185 opening lines, 27 coaching cards, hints, move explanations and game review.
- Optional accounts using a player name, email login ID and password.
- Private saved games, practice rating and preferences across devices, with conflict handling when two devices have different progress.
- Private records for the most recent 200 completed games.
- An in-app leaderboard of player names and practice ratings, eligible after one rated game.
- Wooden and dark themes, keyboard board controls, accessible dialogs and mobile layouts.
- Offline guest play and installation support; app updates wait until an active game finishes.
- HTTPS hosting at [chess.clauding-lab.com](https://chess.clauding-lab.com), an isolated account database, consistent daily backups and automated repository checks.

### Reliability and privacy

- Chess calculations run in a separate browser worker; stale results cannot change a new game.
- Saved positions are validated by replaying legal moves. Hints and takebacks void rating, and reloads do not apply the same result twice.
- Passwords are hashed, account queries are scoped to the signed-in user, request sizes and rates are limited, and private responses stay outside the offline cache.
- Leaderboard entries expose display names, practice ratings and rated-game counts. Email addresses and individual game records remain private.

### Known limitations

- Email addresses are not verified; no email delivery or automatic forgotten-password recovery is configured. Password changes are available while signed in.
- Ratings are personal practice metrics, not official FIDE ratings or independently verified competitive scores.
- Guest saves remain local; signing in does not automatically import guest history. Login and cloud synchronization require a connection.
- Use one playing tab at a time. Cross-device conflicts require a choice; boards do not update live between devices.
- Physical Android/iOS installation and performance checks remain pending. Daily backups are stored on the same server until a separate backup destination is provisioned.

[1.0.0]: https://github.com/clauding-lab/chess-prodigy/releases/tag/v1.0.0

[1.0.1]: https://github.com/clauding-lab/chess-prodigy/releases/tag/v1.0.1
