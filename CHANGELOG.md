# Changelog

## [2.4.1] — 2026-09-12 (BDT)

- Add About beside the account control, showing the installed app version, developer Adnan Rashid and the GitHub repository. The panel works offline and follows the selected theme.
- Let crowded account controls wrap on smaller screens.

## [2.4.0] — 2026-09-12 (BDT)

- Give new Morphy games designed development, central-break and coordinated-attack priorities outside the unchanged documented repertoire. Neutral search governs endgames and bounds stylistic choices; coaching remains independent.
- Measure the new plans-v1 opponent across 400 complete games: Casual 1225, Club 1400 and Strong 1625. Independent replay and calculation audits passed. These are internal Practice Ratings; earlier versions retain their own values.
- Keep one visible Paul Morphy choice, with new setup selecting the new version and earlier saved games/rematches preserving their original behavior and ratings.
- Advance guest/account/history recovery generations and permanently require client policy 3 after accepting version 4, including assisted games. Preserve pending saves, exact account acknowledgements, Home/Resume, clocks, explicit offline updates and dark default.

See the [playing-plan checks](docs/verification/morphy-plans/behaviour-report.md) and [strength measurement](docs/verification/morphy-plans/measurement-report.md).

## [2.3.0] — 2026-09-12 (BDT)

- New Morphy games use documented continuations from 247 validated normal games and 6,940 positions, followed by preferences learned from his games. The historical opponent uses its own repertoire; the original opening and coaching content is preserved.
- Measure historical-v1 across 400 complete games from the initial position: Casual 1275, Club 1375 and Strong 1775 on the app's Practice Rating scale. Independent legal replay and result audits passed; historical move prediction was evaluated separately on 57 held-out whole games.
- Preserve earlier Morphy games, rematches and fixed ratings. Explain the historical opponent and identify earlier saved opponents in the interface.
- Protect the new version with separate local save generations and a persistent minimum client policy, including assisted games and practice reset. Preserve pending account changes, recovery copies, Home/Resume, clocks and offline updates.

See the [historical sources](docs/verification/morphy-history/README.md), [model evaluation](docs/verification/morphy-history/model-report.md) and [strength measurement](docs/verification/morphy-history/measurement-report.md).

## [2.2.1] — 2026-09-12 (BDT)

- Strengthen Home preview piece outlines for legibility with Linux chess fonts: light outlines on dark-board black pieces, dark outlines on wooden-board white pieces. Preserve piece colours and the playing board.

## [2.2.0] — 2026-09-12 (BDT)

- Home replaces the automatic setup dialog, with a saved-board preview, prominent Resume game, result access, opponent introductions and links to games, accounts and friend play.
- Every started unfinished computer game must be resumed or explicitly forfeited before replacement. The warning shows the current opponent's exact rating effect, including unrated games and the rating floor.
- Timed games continue on Home and across app closure; elapsed time settles before resuming, with once-only results. Home navigation preserves pending timed computer replies. Untimed computer work can pause on Home.
- A failed result save preserves the completed active game and exposes recovery before another game can replace it. Existing accounts, recorded games, offline updates and measured Morphy versions are preserved.

See the [home-screen verification record](docs/verification/2026-09-12-home-and-resume.md).

## [2.1.0] — 2026-09-12 (BDT)

- Measured Paul Morphy against Classic across 400 synthetic games: Casual 1200, Club 1375, Strong 1825 on the existing app scale. Full games, estimates, uncertainty and source fingerprints are retained.
- New versioned Morphy games affect Practice Rating; legacy beta games remain unrated. Hints, takebacks, once-only settlement and Classic/1v1 formulas are preserved.
- Separate local save generations retain older recovery copies and protect new progress from older tabs. Persistent server policy blocks obsolete writes after measured Morphy, including after reset.
- Hosted Morphy stays enabled. Updates wait for explicit action after the active game ends.

See the [calibration and verification record](docs/verification/2026-09-12-morphy-calibration.md). These values are internal relative measurements, not FIDE ratings.

## [2.0.0] — 2026-09-11 (BDT)

- Games history for the most recent 200 completed computer games, legal read-only replay, private retained results by opponent version/difficulty, and rematches with preserved setup choices.
- Optional, default-off Paul Morphy beta with bounded attack/development preferences and seeded, reproducible opening choices. All beta games are unrated; Classic rating calculations are unchanged.
- Independent neutral review and hints across workers, live/persisted caches, legacy restoration and annotation recomputation. Opponent evaluations cannot masquerade as coaching review.
- Practice Rating wording now describes the existing in-app measure without implying an official FIDE rating.
- Version 2 saves preserve original legacy keys and pending account writes. Unknown opponent versions remain recoverable/read-only. Damaged or unavailable history is reported honestly; a failed archive cannot silently discard the completed active game.
- A timeout is a draw when the non-flagging opponent has only a king. Other timeout/rating rules remain unchanged.
- Includes the post-1.2 H2H navigation, temporary chat, unread indicator, touch-audio retry and abandonment-rating preview documented below.
- Preserves existing accounts, ratings, 1v1, stories, saved progress and offline guest play. No database schema migration, paid service, external analytics or Stockfish.

This publishes source only; the hosted application is not deployed by this release. Morphy remains a beta and requires `VITE_PERSONALITY_BETA=true` when starting development or building. Physical-device checks, strength calibration and commercial naming clearance remain outstanding. See the [release record](docs/verification/2026-09-11-v2-release.md) for measured checks and migration limits.

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

[2.0.0]: https://github.com/clauding-lab/chess-prodigy/releases/tag/v2.0.0
