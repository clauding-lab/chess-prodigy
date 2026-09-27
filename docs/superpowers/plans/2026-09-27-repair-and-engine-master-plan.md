# Chess Prodigy repairs and engine improvement plan

**Date:** 27 September 2026 BDT
**Status:** Complete proposed programme; policy decisions below are proposals, not approvals. No implementation or release is initiated by this document.
**Goal:** Protect progress, make games and coaching dependable, close every item in the 25 September review, and improve playing strength and recognizable opponent personalities as equal objectives.
**Architecture:** Retain the existing React/TypeScript application and SQLite account service. Repair storage and lifecycle boundaries first. Develop new playing policies alongside frozen existing policies; upgrade the neutral reviewer independently of opponent personalities.
**Inputs:** `AGENTS.md`, `VISION.md`, `.review-scratch/_report/chess-prodigy-review-2026-09-25.md`, `.review-scratch/engine-probe/_report/engine-sameness-report.md`, and the two 25 September vault session notes.
**Engine design:** [Engine improvement design](../specs/2026-09-27-engine-improvement-design.md).

This is a programme plan with implementation packages, files, concrete acceptance cases, dependencies and decision gates. Detailed patches are to be developed against the then-current source after design approval; the document does not pretend untested code snippets are completed repairs. Use `superpowers:executing-plans` for native execution; choose subagent-driven execution only if the owner selects it. Required independent code/security reviews still apply to implemented changes.

## Scope and evidence

All 68 review IDs have a disposition in the coverage table. A disposition can be a fix, a missing regression test, an investigation with an explicit decision, or an accepted product limitation. A finding is not closed merely because it appears in this plan.

On 27 September, six retained reproduction tests and the timeout script reproduced F03, F04, G1.4.1 and the F01 timeout mechanism on local main. Other findings retain Claude's evidence until their package reproduces them. Forced timeouts do not establish phone incidence. Historical measurements do not establish perceived personality.

Preserve the full report and small reproduction fixtures in `docs/verification/repair-20260927/` as the first implementation checkpoint, after excluding browser profiles, accounts, temporary databases and unrelated files. Record source commit, command, expected failure and observed result per finding. Preserve the original report unchanged; put corrections in a separate disposition ledger.

## Constraints that apply to every package

- Dark default, saved theme choices and Wooden option remain.
- Keep all 185 opening lines, 27 original coaching records and accepted sourced stories. Detection fixes do not authorize rewriting historical prose.
- Existing Classic/Morphy/roster playing policies, measured values, receipts, rematches and seeds remain exact. New behavior gets a new version and fresh measurement before rated activation.
- Current authority is guest state-v7/account-v7/history-v6; wire schema is 2; account minimum policy is at least 5 after roster acceptance and never decreases. Preserve all recovery generations and pending writes. A new representation requires an explicit migration and compatibility plan, not an in-place reinterpretation.
- Guest data never imports into accounts. Ownership comes from authenticated sessions. Keep raw legacy acknowledgements intact while normalizing derived data only at client boundaries.
- Human matches remain separate and untimed. Preserve atomic completion/rating/H2H updates and participant-only ephemeral chat.
- No Stockfish integration, replacement engine, paid service, real notification sends, live-player inspection, destructive cleanup, or shipping is implied by this planning request.
- Keep old worktrees, failed engine experiments and saved Home edits. Use a new branch/worktree when implementation begins; do not blindly apply the old documentation branch.

## Proposed decisions requiring owner review

| Decision | Recommended policy | Dependent packages |
|---|---|---|
| D1: closed/suspended computer turn | Continue wall-clock settlement, but a timeout reached while computer execution was interrupted must not grant a rated win. Preserve the outcome as an unrated interrupted game. Distinguish this from a genuine timeout while the engine is running. Do not retroactively alter receipts. | R08, E1 |
| D2: takebacks after terminal results | Consistently disallow undo after timeout, resignation or explicit forfeit/abandonment. Preserve existing allowed checkmate/draw takebacks, making them unrated and reversing only their own receipt. | R09 |
| D3: storage unavailable | Offer an explicitly temporary, unrated session with clear loss-on-close wording; never claim it was saved. Recovery/export of existing data comes before replacement. | R05 |
| D4: email abuse and account discovery | Add fair quotas without changing login identities. Retain unverified email login and document registration-discovery limits. Consent/verification emails are a separate product change. | R13 |
| D5: coaching verdicts | Compare best and played moves from the same position and completed depth; show unavailable/incomplete analysis instead of a confident grade from incomparable scores. Keep documented-game provenance separate. | R11 |
| D6: personality versus strength | Owner answered on 27 September: stronger play and distinct personalities equally. Require separate passing evidence for both. Preserve exact documented opening frequencies initially as a proposed design choice. | E0–E5 |
| D7: interrupted unsynced sign-out | Attempt bounded sync, then offer cancel or explicit sign-out retaining a private recoverable pending copy. Never discard pending changes silently. Do not delete old recovery generations as routine cleanup. | R06 |
| D8: measurement stopping | Enforce the currently declared first-eligible 50/100/200-pair checkpoints for existing protocols. Independently assess fixed-size sampling for future policies before any new rated run; never reprice old receipts. | R18, E6 |

These decisions are localized gates. Unrelated, approved repairs need not wait for an engine redesign or a live-database inspection.

## Delivery order and dependencies

1. **Foundation:** R00 evidence and R01 verification coverage.
2. **Release candidate A — progress protection:** R02–R06 and R19. R03 precedes R04; R04 and R05 share a reviewed persistence contract. Include R07 lifecycle protection where account work depends on it.
3. **Release candidate B — dependable play:** R07–R12, R14–R17. D1/D2/D5 decisions precede their behavior changes. F30 rule changes remain versioned as described below.
4. **Release candidate C — operational resilience:** R13, R18 and remaining R01/R17 hardening. Security corrections with demonstrated immediate impact may move earlier.
5. **Engine programme:** E0 baseline can run independently; E1–E5 prototypes follow compatibility design and clock decisions. E6 rating activation follows R18 and successful personality/safety gates.

Each candidate must be independently usable and reviewable. Do not delay a verified saving repair while waiting for hundreds of engine games. Shared files are edited sequentially unless execution ownership is explicitly split.

## Implementation and verification packages

Every package follows this sequence: reproduce or refute the specific report; add a behavior test that fails for the identified reason; implement the smallest coherent correction; run focused tests; review the diff; record evidence and commit with a Conventional Commit message. If a report is refuted, retain the reproduction and explain the exact changed conclusion. Do not weaken assertions to obtain a pass.

### R00 — Evidence and closure ledger

**Files:** create `docs/verification/repair-20260927/{findings.md,evidence.md}`; retain selected scratch fixtures alongside their promoted tests.

- [ ] Map every coverage-table ID to reproduced, test-gap, policy, plausible or documentation status; record duplicates without inflating repair counts.
- [ ] Save hashes of frozen engine, repertoire and calibration inputs before runtime work. Record current Git state and Node version.
- [ ] For each completed package record before/after command, observed behavior, reviewer outcome, compatibility effect and any unresolved owner decision.
- [ ] Confirm 68 IDs are represented exactly once in the coverage table and none is silently omitted from final disposition.

### R01 — Verify the app that is actually hosted

**Findings:** F23, F44, F45, F53, G2.1.1.
**Files:** `.github/workflows/ci.yml`, `vite.config.ts`, `tests/browser/{records,historical-morphy}.spec.ts`, `tests/engine/*`, `tests/calibration/chigorin.test.ts`, existing `tests/calibration/process.ts`, `AGENTS.md`.

- [ ] Add separate default-off and `VITE_PERSONALITY_BETA=true` build/browser jobs. The same flag must reach build and browser processes; isolate outputs so jobs cannot reuse the wrong bundle.
- [ ] Replace successful early returns with explicit flag-off tests and visible skips for enabled-only scenarios.
- [ ] Reuse bounded asynchronous subprocess handling in Chigorin calibration tests. Bound CPU-heavy tests using measured isolated/full-suite timings; do not change production engine deadlines.
- [ ] Pin action revisions and scanner archive integrity to independently checked constants at implementation time. Add dependency update maintenance, with no new deployment credentials.
- [ ] Reconcile the obsolete 3 MiB documentation with the current 8 MiB per-file limit. Verify every emitted worker is included in the offline precache, in both builds; oversized workers fail the build.
**Acceptance:** all six enabled opponent cards and their start/result/reload paths are actually exercised; default-off remains tested; deliberately removing a worker from precache fails a check.

### R02 — Legal takebacks must remain saveable

**Finding:** F03.
**Files:** `src/storage/schema.ts`; add `tests/storage/takeback-transposition.test.ts`; extend `tests/game/useGame.test.tsx`.

- [ ] Promote the existing reproduction: `e4 e5 Nf3 Nc6`, two takebacks, then `Nf3 e5 e4`. Assert valid load, successful save, reload, resignation and subsequent new game. Retain the no-takeback control.
- [ ] Compare positive repetition counts by key/value membership, independent of insertion order. Continue rejecting wrong counts, missing positions, illegal history and unexpected positive keys. Preserve compatibility with stored zero-count entries.
- [ ] Verify both guest persistence and account normalization use the corrected validator.
**Acceptance:** the reported sequence succeeds without relaxing legal replay or changing engine behavior.

### R03 — Agree on save limits and expose permanent rejection

**Finding:** F04.
**Files:** `server/{app,records}.ts`, `src/account/{sync,types,AccountShell}.tsx/ts`, `src/storage/{schema,history}.ts`, `src/game/{archive,useGame}.ts`; tests in `tests/{account,server,storage}`.

- [ ] Measure encoded bytes for legal reviewed games, long games and takeback-heavy histories. Define one explicit client/server/archival capacity contract before choosing numeric limits; include request overhead and all derived review data.
- [ ] Preserve already-created oversized pending saves as exportable recovery data. A 400/413 is a permanent rejected state with an explained recovery action, not an offline retry loop.
- [ ] Prefer removing/recomputing derived review payload from a new transport representation over discarding moves or ratings. If transport changes, version it and acknowledge the exact representation sent; never alter old acknowledgement comparison semantics.
- [ ] Count normalized positive repetition entries rather than obsolete zero entries. Bound input processing before replaying hostile oversized input.
- [ ] Prevent normal play from entering an unarchivable state: either support the legal maximum under documented bounded resources or obtain approval for a visible capacity-ending rule. Do not invent a rated draw or silently cap history.
**Acceptance:** retained 240/250-half-move and 572-key cases have a successful supported path; a deliberately over-limit save remains recoverable; later pending results are preserved; no endless automatic retries of a permanent rejection.

### R04 — Account authority and idempotent synchronization

**Findings:** G1.4.1, G1.5.1, F14, F32, F47, G1.1.2.
**Files:** `src/account/{AccountShell,sync,types,records}.tsx/ts`, `server/records.ts`; `tests/account/sync.test.ts`, `tests/server/accounts.test.ts`; add account-shell tests.

- [ ] Represent loading/unavailable, authentic cached data and confirmed empty server data distinctly. A failed download with no cache cannot create writable account authority. Offer retry or explicitly isolated guest play.
- [ ] Permit “Keep this device” only for a validated account copy with known lineage. Never promote an invented blank session into a server overwrite.
- [ ] Detect retry of an already-accepted write without losing later pending entries. Use an explicit scoped operation identity plus exact payload identity if current raw-snapshot comparison is insufficient; reject reuse of one identity with different content. Document migration before adding wire fields.
- [ ] Reject/quarantine a remote version lower than an acknowledged version; do not silently adopt it.
- [ ] Check the persistent minimum client policy before stale-version conflict reporting. Return upgrade-required, preserve pending data and avoid sending an incompatible client a misleading conflict choice.
**Acceptance:** simulate committed PUT/lost response, retry after reload, lower server version, 426 and failed initial GET. Rating/game count never resets to a fabricated default; later pending games remain queued exactly once.

### R05 — Multiple tabs and recoverable storage failures

**Findings:** F12, G1.1.1, F13, G1.4.2.
**Files:** `src/game/useGame.ts`, `src/storage/{store,history}.ts`, `src/account/sync.ts`, `src/App.tsx`; add a focused storage-coordination module and `tests/browser/multiple-tabs.spec.ts`.

- [ ] Define one writable session per guest/account identity. Acquire an origin-scoped browser lock before read-modify-write; attach a monotonic storage revision to reject stale work. Other tabs observe or request explicit handover after re-reading current state.
- [ ] Persist transitions promptly while the writer is alive; pagehide must never write a stale whole snapshot. Cross-tab notifications inform the UI but are not an atomic lock.
- [ ] Feature-detect locking. If unavailable, use a reviewed transactional alternative or block ambiguous writes with recovery; do not claim a localStorage read-then-write check is atomic.
- [ ] For corrupt history, preserve original bytes, allow export and explicit archive recovery. Never replace it with an empty history automatically.
- [ ] Implement D3 temporary mode separately from damaged persistent state; inability to save must not trap a temporary session forever.
**Acceptance:** two tabs simultaneously move, finish, hide, reconnect and change accounts; at most one accepted writer, no rolled-back receipt and no overwritten pending queue. Cover blocked storage, quota exhaustion, a crashed lock holder and corrupt archives.

### R06 — Session expiry, push ownership and sign-out

**Findings:** F21, F40, F41, G1.5.3.
**Files:** `src/account/{AccountShell,AccountModals,api}.tsx/ts`, `src/multiplayer/{api,notifications,Multiplayer,HeadToHead,Chat}.tsx/ts`, relevant server push routes.

- [ ] Propagate authenticated-request expiry to one account-shell recovery state. Expose sign-in again from multiplayer/chat/H2H; stop misleading “Saved to account” status.
- [ ] Treat an already-expired sign-out response as session ended, but still require safe push reconciliation before guest/account switching.
- [ ] Bind push changes to the current account and device ownership generation. A stale A tab must not unsubscribe B's current device after ownership changes.
- [ ] Implement D7 pending-save disclosure with bounded sync. Keep retained pending copies isolated to their account. Do not indiscriminately delete legacy recovery keys.
**Acceptance:** revoke session mid-match, sign out offline with pending results, fail unsubscribe, and switch A→B while an old A tab wakes. No cross-account alerts or data writes.

### R07 — Own and cancel background work correctly

**Findings:** F11, G1.5.2.
**Files:** `src/game/useGame.ts`, `src/worker/client.ts`, `src/account/AccountShell.tsx`; `tests/game/useGame.test.tsx`, account-shell tests.

- [ ] Scope cancellation to game identity, revision, operation kind and the token that created the job. A passive coach effect must not cancel an unrelated hint/review/AI request.
- [ ] Keep storage adapter identity stable across display-name changes. Preserve a timed reply's original ready deadline across preferences and navigation.
- [ ] Every cancellation settles visible hint/review state; preserve hint assistance/rating rules without leaving a charged hint permanently pending.
**Acceptance:** toggle Coach, rename, navigate Home/multiplayer, undo and unmount while each operation is pending. Exactly one current reply applies; stale replies never apply; no endless “reviewing”.

### R08 — Clock and engine-failure semantics

**Findings:** F02, F15, G1.3.1, G1.3.3.
**Files:** `src/game/{state,useGame,types}.ts`, `src/App.tsx`, `src/worker/{client,protocol}.ts`; game/browser clock tests.

- [ ] Preserve setup pause ownership when multiplayer opens; an unstarted background game cannot start itself or consume a player's time.
- [ ] Implement D1 only after approval, including persistent interruption provenance, settle-before-resume and no retroactive rating changes.
- [ ] Engine crashes/unavailable workers expose retry/recovery and cannot manufacture a rated win. Preserve the last valid position and explicit failure state across reload.
- [ ] Separate cosmetic reply delay from actual search budget. Propose capping the one-second animation delay near flag fall; this changes approved timing behavior and must be recorded. Search-budget changes belong to a new measured policy.
**Acceptance:** fake-clock boundary cases at 0/1/250/1000 ms, suspension during each side's turn, settled timeout before Home resume, worker crash, ready-but-held move and double reload. No duplicate receipt.

### R09 — Results, archive retention and timestamp validity

**Findings:** F16, G1.4.3, F33, G2.2.1.
**Files:** `src/game/{state,archive}.ts`, `src/storage/{schema,history}.ts`, `src/account/sync.ts`, `server/records.ts`, `src/ui/Modals.tsx`, `src/App.tsx`.

- [ ] Enforce D2 centrally in the reducer/action contract and mirror it in every button; hiding a button alone is insufficient.
- [ ] Keep an eviction recovery record tied to the reversible terminal receipt so undo at the 200-game cap restores the evicted record. An unbounded archive or merely delaying deletion until UI close is not sufficient. Version storage if the recovery record changes authority.
- [ ] Apply compatible timestamp bounds at client and server and make date/rating presentation total: boundary input must return validation failure, not throw. Preserve recoverable raw input instead of silently rewriting dates.
**Acceptance:** finish/undo/reload/sync at archive cap, including another tab and another completed game; exactly the appropriate receipt reverses and unrelated records survive. Test maximum dates and derived date arithmetic.

### R10 — Rules and compatibility regression coverage

**Findings:** F10, F22, F30, F31, F46.
**Files:** `src/engine/{board,morphy}.ts`, `src/game/state.ts`, `src/worker/*`; tests under `tests/{game,engine,storage,worker,server}`.

- [ ] Exercise production threefold, legal-en-passant repetition identity, undo counts, fifty-move, stalemate, mate precedence and insufficient material. Include a real server multiplayer draw and exactly-once rating/H2H outcome.
- [ ] Load a nonempty real terminal record from every recovery generation, migrate, reload and test precedence between generations and corrupt current data.
- [ ] Reject unsupported roster identities in the neutral worker route instead of silently dispatching a legacy Morphy policy.
- [ ] Pin Classic 900/1350/1800 through public rating lookup and golden saved receipts, not labels alone.
- [ ] Expand dead-position handling for same-color bishops only after proving the exact rule. Because `board.ts` also affects existing search and game termination, isolate historical behavior for old rated versions and specify human-rule migration; do not alter frozen policies incidentally.
**Acceptance:** intentional mutation of each production draw branch, old generation or Classic value fails a meaningful test; legal move generation/perft remains unchanged except explicitly specified terminal classification.

### R11 — Trustworthy coaching and motif detection

**Findings:** F05, F24, F25, F48, F49, F50.
**Files:** `src/engine/reviewer.ts`, `src/coach/{annotate,motifs,types}.ts`, `src/worker/{execute,protocol}.ts`, `src/ui/CoachPanel.tsx`, `src/ui/Modals.tsx`; reviewer/coach/browser tests.

- [ ] Introduce a new neutral-review policy using comparable best-versus-played scores at one root and completed depth. Record root position, full-history identity, score perspective, completion and policy version. Incomplete comparisons do not produce confident grades.
- [ ] Keep display evaluation and move-loss grading distinct; do not subtract unmatched before/after searches. Never accept an opponent's style score as neutral analysis.
- [ ] Separate “in the coaching opening” from “documented in this master's games”; neither is an automatic certificate of move quality. Retain historical evidence without suppressing neutral grades.
- [ ] Add positive and negative fixtures for discovered-attack retreats, promotions mistaken for sacrifices, pinned pseudo-attackers, changes in doubled-pawn counts and pawnless edge mates. For doubled pawns, propose describing the mover's newly doubled pawns rather than a nonexistent creation of enemy doubling; obtain copy/trigger approval.
- [ ] Recheck curated lines for parity artifacts, but do not require every historical/theory move to be flawless. Include known bad book moves and sound non-book moves to prevent circular validation.
**Acceptance:** demonstrated odd-depth grading artifact disappears, real blunders still grade worse, old/new review data never mixes, and historical prose remains intact.

### R12 — Mobile, keyboard and interface consistency

**Findings:** F17, F18, F36, F37, F38, F39, G1.4.4.
**Files:** `src/ui/{Board,Modal,Modals}.tsx`, `src/ui/{theme,recorded-games}.css`, `src/App.tsx`, `src/multiplayer/Multiplayer.tsx`; UI/browser tests.

- [ ] Wrap opponent choices and test all six at 320/390 px, zoom and long names. Correct Recorded games specificity without global modal regressions.
- [ ] Retain a stable focus target when the board temporarily disallows moving; restore keyboard navigation after replies and promotion.
- [ ] Default destructive confirmations to the least destructive action; preserve stack-aware focus/inert handling.
- [ ] Lift PlayerBar component identity out of the ticking App body. Verify focus/DOM continuity while clocks update.
- [ ] Keep a mounted announcement region and change its text. Validate F38 on an actual screen reader before claiming closure.
- [ ] Use replacement navigation for consumed invitation redirects so Back leaves the view rather than reopening it indefinitely.
**Acceptance:** real browser keyboard journey and screenshots, no clipped choices, no focus loss at ticks, and a recorded manual assistive-technology result for announcement behavior.

### R13 — Authentication, notification fairness and chat quotas

**Findings:** F07, F08, F27, F28.
**Files:** `server/{auth,notifications,chat}.ts`, associated server tests and `deploy/README.md`.

- [ ] Explicitly enable origin/CSRF protections in test and runtime configuration using the installed Better Auth version. Test malicious origins, sibling subdomains and permitted same-origin flows; do not indiscriminately reject legitimate browser requests without checking their contract.
- [ ] Keep login email untouched. Use separate, documented quota identities for known provider alias rules only; do not strip plus tags/dots across arbitrary domains. Add sender/creator and account fairness budgets so many aliases cannot exhaust all capacity. Test limits with fake delivery only.
- [ ] Limit chat peers per participant and concurrent rooms per account, preserving capacity for the other participant; preserve volatile erasure, epochs and tombstones.
- [ ] Reproduce registration discovery and document D4 disposition. A generic frontend message alone cannot hide an API-level distinction. Verification/consent redesign is separate if the owner wants stronger protection.
**Acceptance:** allowed authentication still works; cross-origin mutations fail; alias-heavy fake jobs respect fairness; one chat participant cannot fill the other's allotment. No real emails or push.

### R14 — Legacy multiplayer and transactional completion

**Findings:** F09, G1.2.1.
**Files:** `server/multiplayer.ts`; add a bounded legacy-game normalizer; `tests/server/multiplayer.test.ts`.

- [ ] Create v1.2-shaped fixtures from retained source, validate and normalize at the authoritative read/write boundary. Never invent participant ownership or change old results. Malformed or unknown formats fail with recoverable diagnostics.
- [ ] Inject failures between game completion, Elo update and H2H update, and during join. Confirm all-or-nothing rollback and safe retry.
- [ ] Prove compatibility on disposable SQLite copies. An actual count/inspection of affected live-player games remains a separate authorized step, not a prerequisite for the fixture-based fix.
**Acceptance:** legal legacy games continue; invalid games cannot mutate; failed completion has zero partial rating/H2H effects; successful retry applies once.

### R15 — Bounded public and multiplayer queries

**Findings:** F06, F20.
**Files:** `server/{records,multiplayer,app}.ts`, `src/multiplayer/{api,types,HeadToHead,Multiplayer}.tsx/ts`, account modal callers; server/browser tests.

- [ ] Materialize validated practice rating and rated-game count into indexed columns, update in the same transaction as records, and backfill on disposable data before migration. Invalid rows are quarantined/reported without exposing raw snapshots.
- [ ] Public leaderboard queries use the projection, bounded cache and fair rate limiting. Preserve display-name/rating/count-only disclosure.
- [ ] Split multiplayer summary and detail responses; list/H2H/account callers do not receive review histories. Keep compatibility for older clients during rollout, using an additive summary route/version if required.
**Acceptance:** generated large-account tests show bounded payload/query work; list responses exclude full histories; single-match detail remains participant-only and complete.

### R16 — Safe updates, old assets and worker startup

**Findings:** F19, F34, F35, F42.
**Files:** `src/ui/UpdatePrompt.tsx`, `src/worker/client.ts`, `src/App.tsx`, `server/app.ts`, deploy scripts/runbook, offline/browser tests.

- [ ] Use one cross-view/cross-tab update gate that checks active games, successful save and pending account state before explicit activation. No prompt path may force another active tab to reload.
- [ ] “Later” defers the prompt but leaves a discoverable update action after the game; expose it on Home/settings rather than nagging mid-game.
- [ ] Retain immutable hashed worker assets across compatible releases for a declared retention window. Exercise an old uncontrolled tab through a release switch; expired assets get recoverable, saved-state-aware messaging.
- [ ] Measure cold worker startup separately from search on Mac and a real phone. F34 is an investigation: pool/reuse workers only if it materially helps and cancellation, memory limits and identity are preserved. If reuse changes search warm state or timed play, treat it as playing-policy work requiring new measurement.
**Acceptance:** old/new controlled and uncontrolled tabs, offline restart and every prompt entry point preserve active games; startup/watchdog claims include actual-device evidence.

### R17 — Backup and shutdown reliability

**Findings:** F29, F43.
**Files:** `server/app.ts`, `deploy/{backup.mjs,chess-prodigy-backup.service,README.md}`; add backup/shutdown tests.

- [ ] Test shutdown with pending fake notification work: stop/await worker, close chat timers, then close database. No job writes after close.
- [ ] Validate backup integrity and perform an isolated restore exercise. Separate manual/pre-release retention from daily retention.
- [ ] Configure a failure alert using an explicitly verified existing destination/service, or expose a failed status until one is chosen. Do not assume The Brief's alert service exists or send a real test message without authorization.
**Acceptance:** failed backup exits nonzero, leaves existing good backups intact and raises the configured failure mechanism; restored database opens and passes synthetic data checks.

### R18 — Auditable calibration tooling

**Findings:** F26, F51, F52.
**Files:** `scripts/calibration/{core,protocol,run}.ts`, `tests/calibration/matches.test.ts`; independent audit and measurement records.

- [ ] Pin estimator/manifest constants to one source. Test retained rejected/accepted Casual checkpoints and the width=300 boundary; preserve historical calculations.
- [ ] Write immutable checkpoint summaries and enforce first eligible 50/100/200-pair stop. A later result cannot replace an earlier accepted checkpoint. Distinguish exploratory runs from accepted rated evidence.
- [ ] Independently investigate F52 using declared paired outcome models, estimator error and repeated stopping simulations. Separate conditional early-stop bias from overall bias; do not apply an assumed 24-point correction to published players.
- [ ] Approve a future protocol before new measurements. Do not promise exactly 400 games per opponent: current checkpoints are per level, 100/200/400 complete games each, depending on eligibility. Stop-at-cap failure means no rated activation.
**Acceptance:** attempts to cherry-pick later eligible checkpoints are rejected; missing/unresolved games never qualify; old published evidence still reproduces exactly.

### R19 — Compatibility and recovery integration gate

**Files:** `tests/{storage,account,server,game}`, `docs/verification/repair-20260927/compatibility.md`.

- [ ] Build a golden matrix covering every old opponent/version, terminal receipt, assisted game, guest/account generation and pending envelope.
- [ ] For any changed format, specify read-old/write-new behavior, raw acknowledgement handling, policy floor, export path and incompatible-client rejection before activation.
- [ ] Test pending writes through reload, account reset, tab conflict, upgrade-required and service restart. Policy floors survive every path.
- [ ] Review frozen source diffs. Any accidental old playing-policy change blocks the candidate even if ordinary tests pass.
**Acceptance:** old games/rematches load under their original policy; new formats cannot be overwritten by incompatible clients; no recovery key disappears without an explicit separate decision.

## Engine programme

The linked design supplies the detailed approach. Engine tasks do not get bundled into a saving fix.

| Task | Deliverable | Depends on | Acceptance |
|---|---|---|---|
| E0 | Reproducible baseline, held-out positions, anonymous in-app comparison | Evidence preservation | Separate forced moves from genuine choices; all levels and both real/fixed clocks; no baseline fitted on test positions |
| E1 | New-version timeout-safe search and explicit analysis completeness | D1, R07–R10, R19 | Reported queen-capture case fixed; completed-depth evidence retained; pre-expired requests recover rather than inventing a evaluated move |
| E2 | Measured search efficiency, strength and tactical reliability improvements | E0/E1 | Fixed-work correctness, actual-device timed benefit and held-out results against frozen baselines; no illegal/stale move or unexplained tactical regression |
| E3 | Tal/Fischer contrasting-plan experiment in the actual app behind a default-off flag | E0–E2, D6 | Blind owner comparison improves; independent tactical suite passes; held-out plan differences persist across multiple moves |
| E4 | Extend successful architecture to Morphy, Chigorin and Spassky | E3 passes | Each has distinct tested plan priorities, negative cases and full-game evidence; no copy-and-rename policies |
| E5 | Optional opening-coverage and plan-explanation improvements | E3, provenance design | Exact historical moves stay labeled correctly; designed continuations are separate; no unsupported “thought process” claims |
| E6 | Freeze, independent review, fresh measurement and rated activation | R18/R19; E1–E5 selected changes frozen | Complete legal games from START, color-swapped pairs, production limits, immutable checkpoints; no unresolved games; old receipts unchanged |

If E3 fails, stop expanding the design and report the failed experiment honestly. Reliability repairs still proceed. Steinitz is outside this programme unless separately requested.

## Complete finding coverage

| Review ID | Primary package | Disposition |
|---|---|---|
| F01 | E1 | New-version timeout fallback correction; measure device incidence |
| F02 | R08 | D1 policy decision and boundary tests |
| F03 | R02 | Confirmed legal-save defect |
| F04 | R03 | Confirmed limits/rejection defect |
| F05 | R11 | New neutral-review policy |
| F06 | R15 | Indexed public projection and bounded access |
| F07 | R13 | Explicit auth protections and negative tests |
| F08 | R13 | Notification quota fairness |
| F09 | R14 | Legacy normalization; live incidence separately authorized |
| F10 | R10 | Production draw regression coverage |
| F11 | R07 | Work ownership/cancellation |
| F12 | R05 | Guest tab write ownership |
| F13 | R05 | Explicit temporary-mode recovery |
| F14 | R04 | Lost-acknowledgement retry safety |
| F15 | R08 | Setup pause lifetime |
| F16 | R09 | Consistent terminal undo policy |
| F17 | R12 | Keyboard focus |
| F18 | R12 | Opponent chooser overflow |
| F19 | R16 | One safe update gate |
| F20 | R15 | Multiplayer summary responses |
| F21 | R06 | Expired-session recovery |
| F22 | R10 | Nonempty historical-generation fixtures |
| F23 | R01 | Hosted-enabled browser verification |
| F24 | R11 | Discovered-attack false positives |
| F25 | R11 | Separate historical provenance and neutral grading |
| F26 | R18 | Estimator contract tests |
| F27 | R13 | Fair participant chat quotas |
| F28 | R13 | Product limitation or approved auth redesign |
| F29 | R17 | Shutdown order coverage |
| F30 | R10 | Rule correction with old-policy isolation |
| F31 | R10 | Unsupported worker identity rejection |
| F32 | R04 | Reject server-version regression |
| F33 | R09 | Timestamp validation |
| F34 | R16 | Measure startup; change only with evidence |
| F35 | R16 | Rediscoverable deferred updates |
| F36 | R12 | Safe confirmation focus |
| F37 | R12 | Stable PlayerBar identity |
| F38 | R12 | Live-region correction plus screen-reader validation |
| F39 | R12 | Invitation Back navigation |
| F40 | R06 | Stale-tab push ownership |
| F41 | R06 | Account-shell push integration tests |
| F42 | R16 | Immutable old worker assets |
| F43 | R17 | Backup integrity/retention/failure reporting |
| F44 | R01 | Pinned CI supply-chain inputs |
| F45 | R01 | Measured test budgets |
| F46 | R10 | Classic values and receipt compatibility pins |
| F47 | R04 | Upgrade-required queue preservation tests |
| F48 | R11 | Legal sacrifice detection |
| F49 | R11 | Correct doubled-pawn direction |
| F50 | R11 | Accurate back-rank motif conditions |
| F51 | R18 | Enforced first-eligible checkpoint |
| F52 | R18 | Statistical investigation and prospective policy |
| F53 | R01 | Bounded asynchronous calibration subprocesses |
| G1.1.1 | R05 | Account tab write ownership |
| G1.1.2 | R04 | Policy floor before stale conflict |
| G1.2.1 | R14 | Transaction fault injection |
| G1.3.1 | R08 | Engine failure cannot award rated wins |
| G1.3.2 | E1 | Same fallback mechanism as F01 at Club |
| G1.3.3 | R08 | Ready-reply delay and clock policy |
| G1.4.1 | R04 | Failed-download placeholder authority |
| G1.4.2 | R05 | Corrupt guest-history recovery |
| G1.4.3 | R09 | Reversible archive eviction |
| G1.4.4 | R12 | Recorded-games CSS specificity |
| G1.5.1 | R04 | Duplicate of failed-download authority path |
| G1.5.2 | R07 | Rename must not restart work |
| G1.5.3 | R06 | Explicit pending-sign-out handling |
| G2.1.1 | R01 | Reconcile offline asset ceiling documentation |
| G2.2.1 | R09 | Server/client timestamp boundary consistency |

## Verification and release gates

1. Run focused behavior tests for each package on Node selected by `.nvmrc`; promote durable regressions out of ignored scratch directories.
2. For each candidate: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and clean builds/browser suites in both flag states. Avoid accidentally sharing dist between modes.
3. For UI/update candidates: `npm run test:browser`, accessibility checks against the built preview in both themes, keyboard navigation, phone-sized screenshots, actual-phone offline/startup checks and actual screen-reader evidence where claimed. Browser emulation is explicitly labeled.
4. For storage/server changes: disposable database migration and restore rehearsal, simultaneous tabs, dropped acknowledgements, stale clients, ownership failures, forced transaction failure and corrupted-input recovery.
5. Independent review covers correctness, TypeScript boundaries, security for authentication/input changes, raw acknowledgement preservation and old-policy source fingerprints. Engine changes additionally require independent tactical/personality/calibration review.
6. Report each of the 68 IDs as fixed-and-tested, duplicate-covered, refuted-with-evidence, or explicitly accepted/deferred by the owner. Plausible findings cannot become “fixed” without confirming the relevant behavior.
7. Prepare README/changelog, migration/rollback notes and a concrete release report. Reconfirm authorization for the new candidate at shipping time; this plan alone is not a deployment request. Back up before authorized deployment, retain compatible recovery assets and verify live guest-only flows. No incompatible rollback after a new policy floor.

## Completion definition

Reliability work is complete when every review ID has an evidenced disposition, progress survives the tested failure paths and candidate gates pass. Engine improvement is separately complete when strength improves against frozen baselines, the owner can perceive the approved differences in anonymous actual-app comparisons, tactical/device gates pass and frozen new versions have independently accepted ratings. A larger test count or lower same-move rate alone satisfies neither definition.

## Technical references

Browser locks coordinate exclusive work across same-origin tabs; storage revisions and recovery are still application responsibilities. See [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

SQLite transactions provide the all-or-nothing boundary used by multiplayer completion and indexed leaderboard updates; test actual rollback with the installed driver. See [SQLite transactions](https://www.sqlite.org/lang_transaction.html).
