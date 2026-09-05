# Chess Prodigy — scope and shipping policy

An approachable chess coach: play a custom engine, learn opening plans and motifs, and keep private personal progress. Guest play remains available. Preserve the wooden and dark themes and existing chess/coaching content.

## Current authorization

On 5 September 2026 BDT the owner explicitly authorized continued autonomous building, named email accounts and user records, hosting at chess.clauding-lab.com, and a public GitHub repository with README and release notes. This supersedes the former browser-only/local-only boundary. Implementation, testing, publishing the requested repository/release and deploying the requested hostname do not require repeated approval.

## Boundaries

No new paid services, replacement engine, changed coaching prose, changed practice-rating policy or public email/individual-game data. The owner additionally authorized an in-app public leaderboard of display names and practice ratings. Email is currently an unverified login identifier; no email-delivery service or automatic password recovery is configured. Secrets and the private database never enter Git. Guest records never automatically become another player's account data.

Release checks cover rules, accounts and owner isolation, saved-state validation, cross-device write conflicts, reload-safe rating and game state, keyboard controls, offline guest reopening and safe updates. Physical Android/iOS installation/performance checks remain pending until real devices are available.

Use Conventional Commits and BDT. No force pushes, skipped hooks or destructive operations without explicit sign-off. Further routine fixes may proceed within the authorized scope; broader product or data-use changes need a separately described owner decision.
