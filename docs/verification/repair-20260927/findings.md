# Repair dispositions — 27 September 2026 BDT

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F03 | A takeback followed by a transposition makes the live game impossible to save and blocks every new game | Pending | Original review |
| F04 | Server size limits (256 KiB / 500 plies / key count) reject legal saves that the client accepts, and the client retries the rejected save forever, blocking the account outbox for good (guest 501+ ply games block new games) | Pending | Original review |
| F01 | Casual roster/Chigorin/Morphy-v4 plays an unevaluated capture (hangs queen, walks into mate) whenever depth-1 root search misses the 170 ms budget | Pending | Original review |
| F02 | Closing or suspending the app during the engine's turn in a timed game gives the player a free rated win on time | Pending | Original review |
| F05 | Neutral move grading compares odd-depth (3) scores across opposite side-to-move positions, so the depth-parity swing (~50 cp) alone triggers '?!' or worse on about half of sound moves | Pending | Original review |
| F06 | Public /api/leaderboard parses every stored snapshot (up to 256 KB each) on every anonymous request, blocking the single Node thread | Pending | Original review |
| F07 | Better Auth CSRF/origin protection is switched off inside the test runner and depends on ambient env; no test can catch its removal | Pending | Original review |
| F08 | Email reminders to unverified addresses: the per-address cap is bypassed with aliases, and one actor can use up the app-wide daily budget | Pending | Original review |
| F09 | Friend games saved by v1.2.0 can never accept another move (every move returns 500) | Pending | Original review |
| F10 | Production draw detection in reduceGame (threefold, fifty-move, stalemate, insufficient material) has no enforcing test, yet it decides rated and 1v1 Elo results | Pending | Original review |
| F11 | useGame work-effect cleanup (keyed on coach/workPaused/retry) cancels in-flight work it does not own: a Coach toggle restarts the timed engine reply (burning the engine's clock, even to a rated flag win), hints are silently dropped, and review stays 'reviewing' forever | Pending | Original review |
| F12 | An idle stale second guest tab overwrites newer progress on visibilitychange or pagehide, silently undoing a rated result saved by the other tab (and deleting or orphaning its archive record) | Pending | Original review |
| F13 | With site storage blocked, the first finished game can never be replaced; Enable saving cannot help and its wording is misleading | Pending | Original review |
| F14 | A lost acknowledgement shows up as a false 'another device' conflict, and 'Use cloud copy' then drops later games | Pending | Original review |
| F15 | A New-game setup over an unstarted timed game stops pausing when the player opens multiplayer, so the AI starts the old game and the player's clock can run out (rated loss) | Pending | Original review |
| F16 | Main-screen Undo can take back a lost game after Time out or Resignation, which the result dialog deliberately blocks. This erases the rated loss and restores the clock | Pending | Original review |
| F17 | Keyboard focus is lost after every keyboard move because the board disables all 64 square buttons, including the focused one | Pending | Original review |
| F18 | The Opponent picker in the New game dialog overflows horizontally at every screen width in hosted builds; Mikhail Tal and Bobby Fischer are pushed out of view | Pending | Original review |
| F19 | The 'updates wait until the game finishes' rule can be bypassed: the Play-a-friend screen's own Update prompt ignores (and never saves) a running computer game, and accepting an update in any other window force-reloads every window, including one mid-game | Pending | Original review |
| F20 | Friend-game list sends the full review game for every finished match, and the lobby downloads it every 3 seconds | Pending | Original review |
| F21 | A session revoked or expired while in multiplayer leaves no way to sign in, and sign-out is refused | Pending | Original review |
| F22 | Guest-history recovery generations are never tested with real content, so dropping an older generation from the loader would pass every test | Pending | Original review |
| F23 | CI verifies only the flag-off build, but the hosted site is built with VITE_PERSONALITY_BETA=true; about 62 browser tests of the rated historical opponents are skipped or return early | Pending | Original review |
| F26 | No test checks the estimator's pass/fail rule (z=2.4, width at most 300), and every published Casual rating depended on it | Pending | Original review |
| G1.1.1 | Two tabs of the same account overwrite each other's unsent saves: a rated game can vanish silently, and switching tabs raises a false 'another device' conflict whose main button rolls back the rating | Pending | Original review |
| G1.2.1 | No test would fail if the completion/join transactions were removed; without them a single storage fault double-applies Elo and H2H | Pending | Original review |
| G1.3.1 | When the engine fails during a timed rated game, its clock keeps running under the error notice. The engine then flags and the player is credited a rated win | Pending | Original review |
| G1.3.2 | Scope extension of F01, same code: on devices about 4x or more slower than the M5, the depth-1 full-window root search also misses the Club budget, and Chigorin, Morphy v4 and the roster engines play the unevaluated fallback capture (queen blunders) | Pending | Original review |
| G1.4.1 | If loading account records fails when an account opens, the app plays on a blank default-rating copy. Choosing 'Keep this device' in the conflict dialog then overwrites the account's real Practice Rating on the server | Pending | Original review |
| G1.4.2 | Unreadable guest history blocks every new game after the next finished game, with no in-app way out; the 'Saving is unavailable' / 'Enable saving' notice is wrong for this case | Pending | Original review |
| G1.5.1 | If the account records download fails right after sign-in on a browser with no saved copy, the app invents a blank version-0 session, and "Keep this device" then wipes the account's Practice Rating | Pending | Original review |
| F24 | Discovered-attack detector fires when the moving piece retreats along the line it was blocking and still blocks it | Pending | Original review |
| F25 | Opponent-supplied book flag from historical repertoires overrides neutral grading, contradicting the coach panel's 'Left the book' | Pending | Original review |
| F27 | Volatile chat caps let one participant lock the opponent out, and a small set of accounts can make chat 'busy' for everyone | Pending | Original review |
| F28 | Sign-up reveals whether an email address is registered | Pending | Original review |
| F29 | No test covers the app-level shutdown order: notifications stop before the database closes | Pending | Original review |
| F30 | insufficientMaterial misses dead positions with several bishops all on one square colour | Pending | Original review |
| F31 | Main (neutral) engine worker path silently plays Morphy style-v1 for Spassky/Tal/Fischer identities instead of refusing them; correct play depends only on client routing plus untested always-terminate behaviour | Pending | Original review |
| F32 | Opening an account whose server version went backwards silently replaces the newer, acknowledged device copy | Pending | Original review |
| F33 | parseSavedState accepts clockAt beyond the JavaScript Date range; the account history then throws RangeError | Pending | Original review |
| F34 | Every engine request cold-starts a new module worker (up to 4.7 MB) inside a watchdog with only 1000 ms of slack; real-device startup is unmeasured | Pending | Original review |
| F35 | Pressing Later during an active game hides the update prompt for the rest of the session, even though it says the update will wait until the game finishes | Pending | Original review |
| F36 | Confirmation dialogs put initial focus on the destructive button (Reset rating, Resign, Enable saving), so a repeated Enter confirms irreversible actions | Pending | Original review |
| F37 | PlayerBar is defined inside App, so both player bars are torn down and rebuilt on every render (every 200ms tick in timed games) | Pending | Original review |
| F38 | The toast live region is inserted together with its text, so some screen readers may not announce 'FEN copied' or the audio failure message | Pending | Original review |
| F39 | Invite redirect uses pushState, so Back from the joined game re-joins and bounces forward (back-button trap) | Pending | Original review |
| F40 | A stale tab still showing account A can cancel account B's device push subscription | Pending | Original review |
| F41 | No test would fail if the guest-boot push reconcile or the sign-out push detach were removed | Pending | Original review |
| F42 | After a release switch, tabs the service worker doesn't control lose the engine: every move requests the old hashed worker file, which the new release returns as 404 | Pending | Original review |
| F43 | The nightly database backup has no failure alert and no integrity check, and pre-release backups use up its 14-copy retention | Pending | Original review |
| F44 | CI pins its actions to movable major tags, and checks gitleaks only against a checksum file from the same release | Pending | Original review |
| F45 | Other CPU-bound engine-behaviour tests use the default 5 s timeout and are close to the observed full-suite flake threshold | Pending | Original review |
| F46 | Classic Casual/Strong engine ratings are pinned only by browser button labels; the unit suite passes when they change, yet a change turns every saved terminal Classic receipt 'corrupt' | Pending | Original review |
| F47 | The client's 426 upgrade-required path (outbox and baseVersion preserved) has no test, although the UI promises pending changes are kept | Pending | Original review |
| F48 | Sacrifice detector misclaims promotions and moves that are 'attacked' only by an absolutely pinned piece | Pending | Original review |
| F49 | Doubled-pawn motif can only fire when the mover reduces the enemy's doubling, and then says the enemy's pawns are doubled | Pending | Original review |
| F50 | Back-rank mate label (and its 'own pawns block' explanation) is applied to pawnless edge mates such as K+R vs K | Pending | Original review |
| F51 | The runner does not enforce 'stop at the first passing checkpoint', and a later checkpoint still reports eligible:true | Pending | Original review |
| F52 | The declared stopping rule biases a 50-pair stop downward (about -24 Elo conditional at Casual-like scores); Spassky Casual is the only published Casual level stopped at 50 | Pending | Original review |
| F53 | chigorin.test.ts still makes blocking spawnSync calls with no timeout, the pattern the CI diagnosis fixed only in matches.test.ts | Pending | Original review |
| G1.1.2 | The server answers a stale older client with 409 plus the full record set instead of 426, so a live v2.4.2 client is never told to update | Pending | Original review |
| G1.3.3 | AI requests ignore the engine's remaining clock, and the fixed 1-second reply delay always applies, so the engine flags while holding a ready legal reply | Pending | Original review |
| G1.4.3 | A finished game that is then taken back, at the 200-game cap, permanently deletes an unrelated oldest record: immediately for guests, and on the server after sync for accounts (despite the overlay's stated protection) | Pending | Original review |
| G1.4.4 | recorded-games.css width and narrow-padding rules are dead: theme.css loads later and its .modal rule overrides .recorded-games-modal | Pending | Original review |
| G1.5.2 | Renaming the account rebuilds the storage adapter under the live game: the engine is disposed and restarted, and a hint in progress is lost after its rating penalty is already applied | Pending | Original review |
| G1.5.3 | Sign-out does not sync or warn about unsynced changes, and leaves the account's private snapshot and game-history cache in the browser's localStorage | Pending | Original review |
| G2.1.1 | An AGENTS.md rule still says the offline file-size limit is 3 MiB. The code needs 8 MiB, and an agent that follows the rule breaks the hosted build. | Pending | Original review |
| G2.2.1 | F33 scope note: the server's own clockAt bound (≤ 8.64e15) accepts snapshots that still crash client rating math (ForfeitModal) on every device | Pending | Original review |
