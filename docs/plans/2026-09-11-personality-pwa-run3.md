# Personality PWA — Run 3 implementation plan

> Execution: follow the approved revision-2 handoff using test-first checkpoints and independent review.

11 September 2026 BDT. Owner “go on” invokes bounded Run 3 after the offline investigation.
Spec: `CHESS_PRODIGY_BUILD_HANDOFF.md` revision 2, remaining A4/A5 and Milestone A matrix.

## Actual starting state and constraints

- Persistent checkout `/Users/adnanrashid/Projects/chess-prodigy`, no separate worktree.
- Branch `codex/personality-pwa-run3`; base `32c023d21229a07f6ab4f88f67f4f73a037b6d97`.
- Initial staged/unstaged/untracked changes: none. Earlier Run 1/2/investigation commits preserved.
- Records use the requested `docs/plans` and `docs/verification` convention.
- Node >=22.19, locked dependencies. No release/remote writes/live player data/paid services.
- Preserve Classic formula/receipts, accounts, multiplayer, stories, saves, offline and explicit updates.
- Beta selection stays default off; Morphy remains unrated. No additional roster/Stockfish/iOS work.
- WebKit origin-outage checks pass; simulated-offline tool limitation and physical-device checks
  remain separately recorded. No timing/performance/calibration or naming-clearance claims.

## Design

Reuse account GameRecord v2 and authoritative server archive (200 retained games). Add a separate
versioned guest archive key capped at 200; never send it with active snapshots or import on login.
Share record construction, bounded parsing, idempotent insert/remove and legal replay helpers.
Keep archive moves compact SAN; reconstruct positions by matching legal moves before rendering.
Aggregate retained W/D/L by opponent configuration version and difficulty, separating assistance
and unknown legacy assistance. Do not call retained totals lifetime records.

Account sync retains a cache of server records outside the active snapshot and overlays its own
ordered pending transitions for honest pending results. Server remains the authority. Guard stale
account responses, reinitialization and conflict choices. Guest persistence must preserve terminal
records before replacing an active game; archive corruption/quota failures stay visible/recoverable.

Add one compact Games dialog inside the existing practice interface, with record filters, rivalry
summary and legal replay. Reuse Board and Modal; replay is read-only and cannot touch live workers
or receipts. Results prioritize outcome, eligible rating, comparable recorded rivalry and Rematch/
Review/New game. Rematch opens existing setup with profile/difficulty/colour/time retained; a new
seed/ID is generated on start. Flag-off saved beta games retain review/replay, with clear rematch
unavailability instead of silently switching to Classic. Existing active-game abandonment warning
continues to protect rematches started from history.

## Checkpoints and required checks

- [x] R3.0: fresh npm test/typecheck/lint/format/build/browser/accessibility baseline; commit records.
- [x] R3.1: record/replay/rivalry helpers and bounded guest archive. Files: `src/game/archive.ts`,
  `src/storage/history.ts`, existing `src/account/records.ts`, `server/records.ts` and storage/hooks.
  Red-first tests: legal/illegal replay; missing metadata Classic; profile/version/difficulty and
  assistance separation; retry/undo/recompletion/retention; corrupt/quota storage; terminal handoff.
  Run focused game/storage/account/server tests and source checks; independent review; local commit.
- [x] R3.2: owner-scoped account history cache plus pending-overlay integration in account sync and
  GameStorageAdapter. Test restart/offline pending terminal/undo/recompletion, accepted responses,
  stale-owner isolation, conflict choices, optional cache migration and corruption preservation.
  Keep existing request body/SQL schema and downgrade protection; focused checks/review/commit.
- [x] R3.3: Games/rivalry/replay UI, results and rematch via existing setup. Files: `src/ui/`, App,
  account adapter and focused UI tests. Test both colours, filters/unknown versions, flag off/on,
  fresh ID/seed, keyboard focus, narrow themes, loading/error/recovery and unchanged rating.
  Native guest/account browser journeys, offline replay and cross-account isolation; review/commit.
- [ ] R3 final: existing full suite and all source/build/browser/accessibility checks; focused WebKit
  origin-outage and relevant new UI checks. Map full Milestone A matrix to actual evidence/limits.
  Update README/governance, both records and task-only Downloads recovery; verify bundle/patch,
  commit closeout locally and stop before Milestone B.

## Compatibility and recovery

Active Session schema v2 and server record wire v2 remain unchanged unless inspection proves a
necessary migration. Guest archive has its own version/key; old clients cannot overwrite that key.
Optional account cache fields never travel in PUT snapshots; missing cache yields available server
records or honest offline incompleteness. Corrupt authoritative input is never reset automatically.
No database migration/deployment. Older clients may omit local archive caching but cannot erase
server archives. All source/test additions must fall within existing checks or receive explicit checks.

Baseline passed (285 unit/UI/server tests, 74 browser passes/four existing skips, source/build
checks, Lighthouse 100 both themes). Independent planning review confirmed the design safeguards.
Next: implement shared record/replay helpers and guest persistence with red-first tests.

R3.1 completed: 112 focused game/storage/account/server tests and typecheck/lint/format passed.
Independent reviews approved after generated-output validation and primitive-time fixes. Terminal
completion timestamps now reflect resignation/abandonment, including unrated assisted games;
rating calculations remain unchanged. Guest archive failures preserve active recovery state and
block replacement. Next: account history cache/pending overlay and owner-scoped adapter integration.

## Resume reconciliation — 11 September 2026 BDT

R3.1 commit: `14fadb1f7d0da8a0513de2e6e32315f119e1380f`. R3.2 is implemented but uncommitted;
focused 119 tests / 14 files and source checks passed. Both independent reviewers found no
remaining actionable findings after fixture-order and cleanup-callback corrections. R3.3 has
only an unfinished red UI test, with no component. All six source/test changes are preserved.
The latest explicit user instruction says Run 1 only, in conflict with this record's earlier
interpretation of “go on”. Pause later implementation pending explicit scope selection.
Next, if Run 3 is confirmed: investigate the full-suite App timing failure; reconcile R3.2
checks/commit eligibility; then implement the recorded Games UI test before broad verification.

## Explicit Run 3 resumption — 11 September 2026 BDT

Owner now explicitly says “go for run 3”; scope ambiguity is resolved. Resume the existing
branch and all six unfinished task files at `0698540c41a56fafc78e35c5630a85780c77964b`.
Original Run 3 base remains `32c023d21229a07f6ab4f88f67f4f73a037b6d97`. Index empty.
No new baseline reset: the full dirty-tree failure and isolated App pass are recorded above.
R3.2 gets its declared focused/source checks and local commit; R3.3 completes the missing
Games component, result/rematch integration and browser journeys. Investigate the existing
App wait boundary before final full-suite verification. Use independent bounded implementation
and review agents, with exclusive file ownership. No release or later milestone authorized.

R3.2 focused verification: fresh 119 tests plus typecheck/lint pass and both reviews approve.
Global format failed during concurrent R3.3 edits; rerun after formatting before commit.
Commit its four source files and account test only, leaving R3.3 changes separate. R3.3 now
in progress: recorded dialog implementation agent owns its component/CSS/test; parent owns
App, result/setup integration and completion tests. Existing App timing test gets controlled
999/1000 ms assertions; the application one-second delay remains unchanged.

R3.2 global format rerun passes after the concurrent UI files stabilize. All declared R3.2
checks now pass; checkpoint is eligible. R3.3 component has 12 focused tests and completion/App
integration has 13; native browser and whole-branch review are in progress.

## Measurement definitions (documentation only)

No event collection or external analytics is introduced. For a future approved diagnostic:
- Rematch after loss: denominator is a completed non-assisted loss in a supported profile/version
  and difficulty; numerator is a new game started via its Rematch action with the same configuration
  and difficulty within 30 minutes in the same app session. Colour may change. Count once per loss;
  exclude cancelled setup. Changing opponent/difficulty means a new game, not this metric.
- Next-week return: weekly BDT cohort of players completing a game; return means another completed
  game 7–13 calendar days later. Guest identity is browser-local and erased/reset data prevents a
  reliable person-level denominator. No current collection or retention claim.
- Reliable progress: synthetic completed IDs/receipts/outcomes survive reload, pending sync,
  interruption and conflict without duplicate records; explicit undo removes its own record and
  later recompletion creates one. Automated checks measure this invariant, not human retention.
No targets are invented from the resulting tests. Strength, naming and physical-device gates remain.

R3.3 application and focused checks pass; whole-path review approved the enum validation fix.
Browser review requires one-time test seeding so reload cannot recreate deleted progress.
Final full suite passes 321 tests; enabled-beta browser passes 24; stopped-origin Chrome/WebKit
passes ten with separate artifact output. Default full browser and Lighthouse are running.
Next: fix/recheck test seeding, verify relevant WebKit UI, complete acceptance record and local
checkpoint/recovery export. Keep branch/workspace; the user already selected no merge/push/release.

R3.3 verified: full 321 tests/source checks, canonical 88 browser passes/four existing skips,
Lighthouse 100 both; strengthened one-time-seed 14 browser passes, WebKit UI 7, origin-outage 10,
beta 24 plus post-test-fix two rematches. Independent whole-path and browser reviews have no remaining
findings. Stage only task-owned UI/parser/test/governance/records after diff inspection and commit.
Final action: export verified task-only recovery, record actual checkpoint/HEAD and clean status,
then stop. Physical iPhone, naming, calibration and stronger-review decisions remain outstanding.
