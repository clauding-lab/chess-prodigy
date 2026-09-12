# Chess Prodigy — scope and shipping policy

An approachable chess coach: play a custom engine, learn opening plans and motifs, and keep private personal progress. Guest play remains available. Preserve the wooden and dark themes and existing chess/coaching content.

## Current authorization

On 5 September 2026 BDT the owner explicitly authorized continued autonomous building, named email accounts and user records, hosting at chess.clauding-lab.com, and a public GitHub repository with README and release notes. This supersedes the former browser-only/local-only boundary. Implementation, testing, publishing the requested repository/release and deploying the requested hostname do not require repeated approval.

## Boundaries

Dark mode remains the permanent default, as requested on 12 September 2026 BDT. New guest/account sessions start dark; users can still choose Wooden board and retain that saved preference. Future releases must preserve the dark default.

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

## Run 3 continuation — 11 September 2026 BDT

The owner explicitly says “go for run 3”. This authorizes remaining Milestone A recorded-game
history/replay/rivalry and result/rematch integration, plus full local verification. It supersedes
the prior Run 2 presentation deferral only. Preserve the existing board, themes and optional
coaching. Report retained outcome counts without causal narratives or lifetime claims. Morphy
remains a default-off, unrated beta; commercial naming, strength calibration and physical-device
checks remain separate outstanding decisions. No publishing, deployment or Milestone B/C/D work.

## Version 2 publication — 11 September 2026 BDT

After reporting the local app works, the owner explicitly requested “push and cut a new
2.0 release. update the readme too”. Publishing the completed Runs 1–3 source, updating
README/changelog/version, fast-forwarding main and cutting the v2.0.0 GitHub release are
now authorized. This supersedes the earlier local-only publishing restriction. Deployment
is separate and is not part of this request. Preserve the default-off, unrated Morphy beta,
private data boundaries and the documented calibration/device limitations.

## Rated Morphy authorization — 12 September 2026 BDT

The owner requested deployment of v2.0.0, then enabled hosted Morphy, then explicitly approved measuring Morphy and making it rated with a live update. This supersedes the earlier unrated/local-only boundaries for this scoped change. Version 2 of attack-development retains style-v1 with fixed measured Practice Ratings Casual 1200 / Club 1375 / Strong 1825. Version 1 beta games and their rematches remain unrated. Classic and human rating mathematics are unchanged. Hints/takebacks exclude rating. See docs/verification/2026-09-12-morphy-calibration.md and its retained 400-game evidence.

Preserve guest state-v3/account-v3/history-v2 authority and older recovery keys. Wire schema remains v2. The additive record_client_policy marker permanently requires measured-rating client support after first accepting measured Morphy, including assisted games and after reset. Never roll back to incompatible code or delete this protection. Hosted builds enable VITE_PERSONALITY_BETA; local source defaults remain off.

## Home and resume — 12 September 2026 BDT

The owner approved the home-screen design and implementation: welcome and opponent explanations, saved-board preview, prominent Resume game, and a resume-or-forfeit gate before replacing any started unfinished computer game. Preview the actual rating effect. Timed games continue while Home is open or the app is closed; settle elapsed time and any result before resuming. Ship under the standing hosted-app authorization after verification. Existing rating mathematics and untimed human play are preserved. The subsequent historical-Morphy request is separate from this home-screen release; its playing policy and measured ratings are unchanged here.

## Historical Morphy authorization — 12 September 2026 BDT

The owner approved building the historical Morphy redesign after the Home screen: use his documented moves when positions match, preferences learned from his games elsewhere, and a new strength measurement before rated release. The scoped implementation, verification, source push and deployment to the existing hostname are authorized without another approval. No additional GitHub release tag is requested.

Keep the earlier Morphy opponents and their fixed rating values available for saved games and rematches. The new historical-v1 opponent has its own version and measurement; it must not be presented as a perfect reconstruction or a human/FIDE strength certification. Preserve the validated game facts, source provenance, held-out evaluation and frozen benchmark evidence. New local save generations and a persistent minimum client capability protect progress against incompatible older clients. Home/Resume, ongoing clocks, original coaching content, Classic, human matches and private data boundaries remain intact. Steinitz, Chigorin, paid services and unrelated product changes are outside this task.

## Direct Morphy plans authorization — 12 September 2026 BDT

After the learned experiments failed, the owner approved designed Morphy-inspired playing priorities
and explicitly requested direct implementation in the actual app, then said "go on" after the internal
version explanation. Implement version4/plans-v1, keep documented openings and older games/ratings,
verify development/attacking behaviour and tactical reliability, freshly measure strength and update
the existing live app after release checks. No separate prototype or new visible opponent option.
This changes the previous learned-off-book-preferences requirement; describe the designed policy
honestly. Preserve earlier experiments/results and every old playing/rating policy. See the direct
Morphy plans spec for compatibility and delivery boundaries. No additional release tag requested.

The independently audited direct-plan ratings are Casual 1225 / Club 1400 / Strong 1625. They belong
only to version 4; earlier ratings remain unchanged. The v2.4 update preserves one visible Morphy,
all older games and the permanent dark default. Retain account minimum policy 3 and every recovery
generation after acceptance of version 4; an incompatible v2.3 rollback is outside the safe release
path. Automatic checks demonstrate specified playing behavior, not a guarantee of perceived style.
