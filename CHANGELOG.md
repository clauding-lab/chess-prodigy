# Changelog

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
