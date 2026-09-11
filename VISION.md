# Chess Prodigy — scope and shipping policy

An approachable chess coach: play a custom engine, learn opening plans and motifs, and keep private personal progress. Guest play remains available. Preserve the wooden and dark themes and existing chess/coaching content.

## Current authorization

On 5 September 2026 BDT the owner explicitly authorized continued autonomous building, named email accounts and user records, hosting at chess.clauding-lab.com, and a public GitHub repository with README and release notes. This supersedes the former browser-only/local-only boundary. Implementation, testing, publishing the requested repository/release and deploying the requested hostname do not require repeated approval.

## Boundaries

No new paid services, replacement engine, changed practice-rating policy or public email/individual-game data. On 5 September 2026 BDT the owner also approved richer sourced opening and other-move stories, a persistent scrollable coaching history, a one-second minimum engine reply delay, smoother piece movement and a knight icon on the dark background. Preserve the original opening lines and motif source records; the expanded, sourced motif lessons supersede their displayed prose. Further unrelated coaching-content changes still need owner review. The owner additionally authorized an in-app public leaderboard of display names and practice ratings. Email is currently an unverified login identifier; no email-delivery service or automatic password recovery is configured. Secrets and the private database never enter Git. Guest records never automatically become another player's account data.

Release checks cover rules, accounts and owner isolation, saved-state validation, cross-device write conflicts, reload-safe rating and game state, keyboard controls, offline guest reopening and safe updates. The owner reported successful physical phone verification on 5 September 2026 BDT; the specific device/OS and installation steps were not recorded separately.

Use Conventional Commits and BDT. No force pushes, skipped hooks or destructive operations without explicit sign-off. Further routine fixes may proceed within the authorized scope; broader product or data-use changes need a separately described owner decision.

## Approved expansion — 6 September 2026 BDT

The owner approved the complete invitation-multiplayer design and all implementation/release actions: registered-user 1v1, Brevo email plus optional push, one reminder per overdue turn, separate 1v1 Elo, H2H and name editing. The FIDE Rating display heading carries an explicit unofficial computer-practice qualifier. Practice mathematics remain unchanged. See docs/superpowers/specs/2026-09-06-invite-multiplayer-design.md. No paid service was authorized; use existing Brevo capacity. This supersedes the earlier no-email-delivery boundary.

On 7 September 2026 BDT the owner approved a top H2H tab for signed-in players after their first completed human match, listing lifetime wins, draws and losses per opponent. Each matchup remains accessible to its two participants only.

The owner also approved simple text/emoji chat within 1v1 matches with animated typing indicators. No images, attachments or persistent chat history; either player leaving clears both sides, with a short presence timeout for abrupt disconnections. The shared header uses the existing knight logo before a centered Chess Prodigy wordmark in a distinctive serif font, following the owner's subsequent alignment correction.

Later on 7 September 2026 BDT the owner approved a top Chat shortcut with a pulsing unread dot for offscreen opponent messages, cleared when opened/read, and a steady dot for reduced motion. Remove emoji from the placeholder and explanatory wording while preserving player input. Repair touch audio activation without claiming browser emulation proves physical iPhone audibility.

## Narrow local amendment — 11 September 2026 BDT

The owner supplied revision 2 of `CHESS_PRODIGY_BUILD_HANDOFF.md`. Run 1 authorizes only
A0/A1 independent-review foundations and the scoped bare-king timeout correction, with local
feature-branch commits. Earlier release permissions do not authorize shipping this work.
Paul Morphy, Wilhelm Steinitz and Mikhail Chigorin are settled future development names;
public commercial naming clearance remains outstanding. Practice Rating wording and an
unrated, default-off personality beta belong to a separately invoked Run 2, not this run.
Classic ratings, stories, accounts, multiplayer, saves and offline play remain preserved.

The owner's subsequent “go on” invokes the handoff's bounded Run 2. Locally implement the
Paul Morphy beta, default-off selection, safe resume/archives and explicit unrated eligibility.
Use Practice Rating wording for the existing internal measure. No rivalry/replay/result redesign
or release action is authorized by this continuation. See the dated Run 2 execution records.
