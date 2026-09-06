# Invitation-based 1v1 and notifications

Date: 6 September 2026 BDT
Status: Approved by owner on 6 September 2026 BDT, with all implementation and release approvals granted.

## Confirmed requirements

- Registered users can invite an opponent through a shareable link.
- A recipient registers through the existing form or logs in, then joins the invited game. Preserve the invitation through authentication.
- Joining starts the match even when the inviter is offline. Notify the inviter and allow either player to resume after login.
- Send one reminder per overdue turn after ten minutes without a move, to the player whose turn it is. No recurring reminders for that same turn.
- Support Brevo email plus optional browser/device push notifications.
- Investigate and repair sound being inaudible despite the enabled preference.
- Include a separate 1v1 rating, head-to-head win scores between opponents, and display-name editing.
- Rename the displayed practice-rating heading to “FIDE Rating”, with a visible “Unofficial · computer practice” qualifier to avoid representing it as an actual FIDE-issued rating.

## Proposed play experience

Add a registered-user “Play a friend” action and “My games” list alongside existing engine practice. Guests following invitations see the normal registration/login interface with invitation context. A signed-in recipient joins automatically through an authenticated request; loading a link alone never consumes it.

The inviter chooses White, Black, or random (default). Invitations admit exactly one other account, expire after seven days if unused, and can be cancelled before acceptance. A creator opening their own link sees the waiting screen. Once accepted, reopening the link returns either participant to the same game; another account sees an unavailable invitation without private game details. Simultaneous acceptance must admit only one opponent.

Matches are untimed and affect only the separate 1v1 rating when completed. Ten minutes triggers a reminder, never a forfeit. Players may have multiple ongoing matches and return to them from My games. Existing engine practice saves and ratings remain separate. No hints, live evaluation, or takebacks during a human match; retain the move list and allow coaching/review after completion. Support resignation, agreed draws, and the existing chess rules for game end.

## Ratings, head-to-head scores, and names

Keep the existing computer-practice calculation and saved values unchanged. Use the requested “FIDE Rating” heading with a persistent adjacent “Unofficial · computer practice” qualifier wherever the rating is presented, including the leaderboard. Explanatory text must say that this app does not issue official FIDE ratings and that the score is not a calibrated estimate of an official rating.

The separate 1v1 score uses app-local Elo, starting at 1200: expected score = 1 / (1 + 10^((opponent - player) / 400)); change = 32 × (actual score - expected score). Actual score is 1 for a win, 0.5 for a draw, and 0 for a loss. Preserve internal precision and round for display. Show “Provisional” until ten completed games; this is a display marker, not a different formula. Calculate both changes from the participants’ current ratings together at completion and commit both updates once with the result. Serialize simultaneous game completions involving either account. No user reset for 1v1 ratings. Cancelled/unaccepted invitations and reminders do not affect ratings.

Display both rating categories in the account, the 1v1 rating beside each participant on the board, and separate leaderboard tabs. Show each player's rating change on the result screen. Public 1v1 leaderboard eligibility begins with one completed game; expose only display name, 1v1 rating, and completed-game count. Repeated friend matches are permitted; describe this as a community rating, not an independently verified competitive rating.

Head-to-head (H2H) is a separate lifetime win tally for an unordered pair of account IDs. Example: “Adnan 2–1 Sayem · 1 draw”. Wins increment only the winner's tally; draws have their own count, not half-points in the win score. Show the tally on their match board, after the result, and in each participant's opponent history within My games. Keep this pair history private to the participants. Update it exactly once for each completed game, together with rating changes. Persist totals independently of any truncated game-history display.

Add “Edit name” in the account dialog with Save and Cancel. Apply existing trimmed 1–80 character validation on the server, show save failures, and update account controls, boards, leaderboards, and H2H displays from the current account name. Identity remains tied to immutable account IDs so renaming never resets scores, ratings, ownership, or invitations. Do not change login email or password. Names need not be unique, consistent with current registration.

The board updates while both players are online through short authenticated polling, with immediate refresh on return to the page. This reuses the existing server rather than introducing a persistent-connection subsystem. Clearly show connection loss; do not accept offline moves locally as confirmed moves.

## Shared state and access

Use the existing SQLite database with separate multiplayer records for invitations, participants, moves, results, and turn-start times. The server is authoritative: derive the player from the login session, validate turn ownership and legal moves, and commit a move only against the expected game revision. Repeated requests cannot make duplicate moves. An outdated tab refreshes rather than overwriting another move.

Re-use the pure chess rules without invoking the computer opponent. Save every accepted move and result durably. Both participants can read their match; other users and the public leaderboard cannot. Never expose account email addresses to opponents. Keep multiplayer results out of the existing practice-rating calculation.

Use unguessable invitation tokens and store token hashes. Bound creation, acceptance, and move requests; reject self-joining and moves after completion. Notification links point to fixed-origin game routes and require login and participant authorization.

## Notifications

Create durable notification jobs in the same database transaction as the corresponding game event. A server-side worker processes these while browsers are closed and resumes after server restarts.

Events:

1. Opponent joins: notify the inviter once by email and on enabled push devices.
2. A turn remains unanswered for more than ten minutes: notify the player to move once by email and on enabled push devices.

The first turn begins at invitation acceptance; every accepted move starts the next turn. Jobs carry the game revision and recipient. Recheck that the game and turn are still current immediately before delivery, discarding stale reminders. A send already accepted by an external provider cannot be recalled if a move arrives concurrently.

Use unique event/channel records to prevent duplicate scheduling, bounded retries for temporary failures, and persistent delivery status. Provider timeouts can leave delivery uncertain; do not promise exactly-once external delivery. Avoid sending a queued overdue reminder once that turn is over.

Use Brevo transactional email through server-only credentials, an authorized sender, and the existing fixed public hostname for links. Respect available account limits without buying a paid plan. Email failure does not block gameplay. Disclose game emails at invitation creation and acceptance, provide notification preferences, and bound abuse because current account emails are unverified. This feature does not imply email ownership verification or password recovery.

Push is opt-in per device through an explicit “Enable notifications” action. Handle denied permission and unsupported devices without blocking play. Explain the Home Screen requirement when relevant on iPhone/iPad. Store subscriptions privately against the authenticated account, remove invalid subscriptions, and detach this device on logout/account switching. Deliver minimal lock-screen text with a game link; avoid including email addresses or move details. Recheck account authorization when an alert is opened.

Extend the existing service worker for push receipt and notification clicks while preserving offline engine practice and the explicit “Update now” flow. No forced reload of an active game. Use application-owned push credentials on the server; no paid push service is required.

## Sound investigation and fix

Observed in source: the sound toggle only changes preferences. Audio is initialized at playback, resume errors are ignored, and current tests substitute a fake sound function rather than establish audible browser output. These observations do not yet prove the cause on the owner's device.

Reproduce with real browser audio state, including the first computer move, enabling sound, returning from the background, and muted preference behavior. Activate audio directly from an intentional user interaction and provide a short test sound when enabling it. Schedule tones after successful activation, recover appropriately from browser interruptions, and give useful feedback if audio cannot start. Do not replay historical moves when toggling sound or restoring a game. Verify physical-device audibility with the owner when needed; automated output evidence alone cannot establish speaker audibility.

## Validation and release

Cover independent registered players, invitation preservation through registration/login, acceptance races, authorization, illegal/out-of-turn/duplicate moves, reconnects, game completion, and isolation from engine practice. Verify Elo wins/draws/losses, atomic updates for concurrent completions, duplicate-result protection, H2H draws and wins, name validation and ownership, and unchanged scores after renaming. Exercise notification timing with a controllable clock, server restart, stale jobs, retry limits, channel preferences, and push subscription cleanup. Test real browser invitation journeys with separate account contexts and disposable databases.

Run source checks, existing regression suites, production build, browser checks, and offline/update checks. Test email/push integration with controlled recipients only; do not message real players during testing. Review the changes for correctness, TypeScript safety, and security. Back up the production database before deployment and document additive database changes and rollback constraints.

## Deployment inputs

Before enabling live delivery, locate or configure a Brevo API key and authorized sender privately on the server. Generate application push keys and configure the sender contact. Never put secrets in this document, chat, or Git. Whether an existing Brevo account/sender is available has not yet been checked.

## Review decision

Owner has approved email plus push, one reminder per overdue turn, separate 1v1 ratings, H2H scores, name editing, and the requested FIDE Rating heading. The owner approved the complete written design, including the visible unofficial qualifier, detailed untimed match rules, hidden in-game assistance and invitation lifecycle.
