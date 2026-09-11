# Chess Prodigy — Codex build handoff

**PWA first. Play first. Historical personalities. Independent review.**

Prepared: **11 September 2026, Asia/Dhaka (UTC+6)**
Revision: **2 — local checkpoints, dependency-aware priorities, resumable runs**
Repository: `clauding-lab/chess-prodigy`
Expected local workspace: `~/projects/chess-prodigy` — confirm, do not assume.
Remote baseline inspected: `main` at `f2b45b701795ea2aa03e89688ced04b8106b5928` (8 September 2026).
Package version at that baseline: `1.2.0`.

This is a NEW incremental development brief, not evidence that the work below has been implemented or tested. The local checkout may contain newer work. Inspect it before changing anything. Repository observations are tied to the baseline above; revalidate them locally. Source references appear at the end.

> **First end-to-end target remains Milestone A: a playable Paul Morphy beta with saved progress, independent review, rivalry record, and rematch. Execute it in bounded runs. The first run is A0 + A1 + a checkpoint report, not all of Milestone A. Commit verified checkpoints locally, then stop and report at the selected run boundary. Do not stop at planning or start by rewriting the app.**

## 1. Product decisions: settled

Chess Prodigy is a chess-playing app that helps people improve through enjoyable games, a motivating rating proxy, saved move history, and optional explanations. It is not primarily a course, historical library, or adaptive learning platform.

A player must be able to ignore every learning feature and still enjoy a complete game.

- The board is the primary experience. Keep Play central; Games and Progress support it.
- Keep computer practice, invitation-based friend games, guest access, private accounts, saved progress, and offline guest play.
- Add distinctive historical-style computer opponents. Preserve the full names on selection cards, profiles, results, and rivalry records. Compact board labels may be shorter when necessary.
- Keep personality separate from difficulty. Every released personality must support Casual, Club, and Strong; do not turn the three people into three difficulty levels.
- Keep Practice Rating separate from 1v1 rating. It is an internal progress measure, not an official or externally calibrated chess rating.
- Stories enrich play. Existing explanations stay optional. No mandatory drills, chapters, or homework.
- Develop and validate in the existing PWA. Retain it as a supported product after eventual iOS distribution. Evaluate a small Capacitor iOS build early after the first playable slice, not after every feature is finished.

### Selected historical roster

| Full display name | Description | Proposed behaviour, not a historical-reconstruction claim |
|---|---|---|
| **Paul Morphy** | **Attack & development** | Active development, useful open lines, and justified pressure against the enemy king. |
| **Wilhelm Steinitz** | **Control & method** | Improve the position patiently, maintain sound structure, defend when necessary, and simplify favourably. |
| **Mikhail Chigorin** | **Counterplay & imagination** | Active counterplay and resourceful complications; avoid becoming a duplicate of Morphy. |

Build **Paul Morphy first**, then Steinitz and Chigorin through the same tested architecture. These supersede all earlier proposed rosters and character names.

Names are selected for development, **not legally cleared for public commercial use**. Keep display names, descriptions, artwork, and behavioural IDs separate. Use neutral chess artwork or monograms initially. Do not download portraits, claim endorsement, assume public-domain status, or initiate rights enquiries. Record clearance as an outstanding release decision. An “inspired by” label describes the simulation; it is not permission.

Working identity: **Chess with character.** Do not redesign the existing brand or icon just to insert this line.

## 2. Scope and execution boundaries

Treat this brief, when supplied by the owner as the build task, as the current scope for this development pass. Continue observing applicable repository and environment instructions.

### Allowed in the initial pass

Local code, tests, necessary additive data/schema changes, documentation, disposable test databases, and a locally enabled personality beta within the selected run. Local checkpoint commits on a dedicated feature branch are explicitly authorized when the owner supplies this revision as the build task. Make ordinary reversible implementation choices without repeatedly asking the owner to restate settled decisions. Follow the checkpoint and preservation rules below.

### Not allowed by this handoff

- No production deployment, remote push, pull request, release publication, App Store submission, or access to live player data. Never commit on, merge into, or otherwise update `main` or another shared branch. Leave reviewable local feature-branch commits and report any remaining diff.
- No history rewriting, rebasing, amending prior commits, force operations, skipped hooks, deleting an existing checkout, discarding unrelated changes, clearing real browser data, or resetting a real database. Preserve pre-existing staged, unstaged, and untracked work.
- No new paid services, external model APIs, real email/push dispatch, new analytics collection, or credential changes.
- No Stockfish integration, remote analysis service, rating-formula overhaul, or automatic application of new calibration numbers in Milestone A.
- No new curricula, courses, historical library, public matchmaking, tournaments, payment flow, schools product, or new chat features.
- No native rewrite. Actual iOS packaging is a subsequent compatibility milestone, not a prerequisite for the first PWA slice.

The repository's older deployment authorization does not expand this initial task into a release operation. Run locally with disposable data and keep production unchanged.

Add a dated, narrow scope amendment to `VISION.md` and a short pointer in `AGENTS.md` if required to reconcile the personality beta and the **Practice Rating** display label with older instructions. Preserve historical authorizations, boundaries, and evidence. Do not replace `AGENTS.md` with this entire brief or pretend earlier documents already authorized new services.

## 3. Orient to the existing application

Start with `git status --short`, the current branch and commit, the worktree path, and the installed Node/npm versions. Inspect staged as well as unstaged and untracked changes. Record the starting commit as the review base. Establish or safely resume a local feature branch such as `codex/personality-pwa`; choose a nonconflicting name rather than repoint an existing branch. Do not force a branch change over unrelated work, automatically stash or unstage it, or silently exclude newer owner work by starting from an older commit. Do not pull, reset, or reinitialize the repository automatically. If task changes cannot be isolated safely, report the precise obstruction and continue only safe inspection or task-local documentation.

Read:

- `AGENTS.md`, `VISION.md`, `PRODUCT.md`, `README.md`, and the latest portions of `docs/verification/release-report.md`.
- `CODEX_HANDOFF.md` for historical context only. Its old prototype-port sections are **not** instructions to rebuild the now-existing app. [R1]
- `package.json`, `.nvmrc`, test configuration, and any nested agent instructions relevant to files you edit.

Then trace the implementation paths you touch:

| Area | Existing entry points |
|---|---|
| Rules, search and evaluation | `src/engine/board.ts`, `eval.ts`, `search.ts`, `engine.worker.ts` |
| Worker lifecycle | `src/worker/` |
| Opening selection and explanations | `src/book/`, `src/coach/types.ts`, `annotate.ts`, `motifs.ts` |
| State, clocks and ratings | `src/game/types.ts`, `state.ts`, `useGame.ts`, `src/rating/fide.ts` |
| Guest persistence | `src/storage/` |
| Accounts and synchronization | `src/account/`, `server/records.ts`, `server/auth.ts`, `server/app.ts` |
| Existing interface | `src/App.tsx`, `src/ui/`, `src/multiplayer/` |
| PWA and verification | `vite.config.ts`, `public/`, `tests/`, `docs/verification/` |

Retain the existing React/Vite/TypeScript stack, custom engine, dark and wooden themes, neutral accents, knight branding, one-second minimum computer reply delay, smooth movement, reduced-motion behaviour, keyboard controls, and privacy boundaries. Preserve all original opening lines and motif source content. Do not edit `reference/chess-app.original.jsx`. [R1–R2]

## 4. Milestone A: one opponent working end to end

### Execution order and run boundaries

Milestone A is a product milestone, not a demand to finish every subsection in one agent run. The default first invocation executes **Run 1 only**. Later invocations select the next run from the execution record. Do not silently advance to another run because a test suite passes early.

| Run | Required scope | Explicitly deferred | Stop point |
|---|---|---|---|
| **Run 1: trustworthy reviewer** | A0 baseline/record, A1 complete data-path separation, all four independence tests, necessary legacy-evaluation migrations, and the scoped timeout regression if reproduced. A6 reporting applies throughout. | Morphy implementation, personality selection, new rivalry/replay features, and result-screen redesign. | A1 implemented and its required checks run; update records, commit eligible checkpoints, report, then stop. |
| **Run 2: safe playable Morphy beta** | A2 profile and worker/book integration, A3 unrated-beta protections, the persistence subset of A4, minimum selectable/resumable UI from A5, and the A6 default-off beta flag and verification. Build the flag before exposing selection. | New rivalry aggregation/screens, new archive replay UI, richer result presentation, and enhanced rematch features. | A coherent local Morphy game can be selected, played, saved/resumed and reviewed without changing Classic ratings or existing account/archive behaviour. Report and stop. |
| **Run 3: rivalry and completion** | Remaining A4 archive/replay/rivalry work, remaining A5 result/rematch integration, and the full Milestone A acceptance matrix. | Milestones B, C and D. | Complete the end-to-end Milestone A experience, report verified and blocked evidence, then stop. |

**Priority when constrained:** finish reviewer isolation and its tests before personality work. A testable engine-only Morphy profile may be a later partial checkpoint, but must not be exposed as a playable beta until its safety dependencies are complete. Defer new rivalry screens and result-screen polish rather than deliver a shallow version of everything.

**Dependencies that cannot be deferred from a playable beta:** safe save/resume and schema compatibility, opponent identity/configuration, existing terminal/archive behaviour, neutral-review provenance, unrated eligibility and accurate wording, validation and account isolation, default-off feature gating, and relevant tests. A4 and A5 contain both these essentials and optional presentation work; do not defer either entire section indiscriminately. A6's flag is a prerequisite to exposure, not a cleanup task. Reporting starts before application-code edits.

Use a scope/checkpoint budget rather than an arbitrary invented number of conversational turns. If the owner or runner supplies an actual time, turn or tool budget, record it, honour it, and reserve capacity for tests and recovery reporting. Do not promise an automatic future continuation. As a resource limit approaches, stop starting new sub-projects and checkpoint or preserve the current work. An incomplete run is not the whole milestone completed.

### Local checkpoints and interruption recovery

- After each coherent checkpoint passes its predeclared checks, inspect the staged diff for task scope and secrets and create a local Conventional Commit. The initial plan may be a documentation-only checkpoint after its own checks. Use small checkpoints within A1 rather than waiting for all of A1 to be finished before the first code commit.
- Stage only verified task files or hunks. Do not use blanket staging over a dirty workspace, include someone else's existing staged changes, or silently change the owner's staging. Do not commit secrets, environment files, personal data, live databases, dependency directories, or machine-specific artifacts. A beta switch is not a secrets boundary.
- Each checkpoint's required checks are recorded in advance. At minimum, run relevant regressions, applicable type checks, and diff checks for code changes. Run the broader existing suite at the run boundary. A scoped checkpoint pass is not a claim that unavailable checks or the full release matrix passed.
- Record each checkpoint's purpose and actual checks before its commit. On the next record update, add the resulting commit SHA. The final report must name the actual HEAD and latest verified code checkpoint; do not rewrite history just to embed a commit's own hash into that same commit.
- A required failing or blocked check is not green. Do not suppress it or force a commit around a failing hook. Preserve any unfinished task-only diff and new files, record exact failures and next actions, and identify the last verified checkpoint. Lack of permission, signing tools or a configured Git identity is a specific blocker, not permission to change credentials or impersonate an identity.
- On resume, read the execution record and inspect the actual branch, commit, index and working tree before acting. Reconcile the record with the files; do not assume a previous session's intentions were implemented. Do not reset to the last checkpoint just because unfinished changes remain.
- **Local commits are checkpoints, not independent backups.** Identify whether the working directory is a persistent local checkout or a disposable environment. In a disposable environment, export the task's checkpoint patch series, the execution/verification record, and any task-only uncommitted binary diff plus allowlisted new files through an available owner-accessible artifact mechanism. Keep the base SHA and restore instructions with the export; exclude secrets and unrelated work. Report whether the export was actually made and accessible. Do not upload to GitHub or another service under this permission. Merely leaving another file inside the same disposable environment does not protect against its deletion. [E4]

### A0. Baseline and short implementation plan

**Before the first application-code, test-code, configuration or schema change**, create `docs/plans/2026-09-11-personality-pwa.md` and start `docs/verification/2026-09-11-personality-pwa.md`. If these files already exist, read and extend them; do not overwrite prior results. If repository instructions require another path, record and report the exact chosen equivalent. Do not postpone the initial record until after implementation.

Record the current run, branch/worktree, base SHA, pre-existing changes, planned checkpoints, required checks, blockers and next action. Mark every checkpoint as `not-started`, `in-progress`, `verified`, `blocked` or `deferred`. Initially mark baseline commands pending, then run the existing checks and fill in actual results before implementation. Capture baseline failures without disguising them as new regressions or waiving them silently.

Update the record after each meaningful completed unit, failed attempt that changes the next action, and checkpoint; always update it before voluntarily stopping. Link commands, exit status, test outcomes and affected files to the checkpoint being verified. A record of intentions written at the end is not a resumable execution record.

If tools are missing, report that specifically and continue with safe work within the selected run that can be verified. Do not install unrelated software or silently replace the lockfile. Planning is a first step, not the deliverable.

### A1. Establish independent review before adding personality scores

**Confirmed baseline hazards to recheck:**

1. In `src/game/useGame.ts`, a computer-opponent result is written into `game.evals`; passive analysis and review skip positions that already have an evaluation. [R3]
2. In `src/coach/annotate.ts`, a non-null annotation is retained instead of being recomputed after better analysis. [R4]
3. The inspected `PositionEval` contains `score` and `best`, without analysis provenance. [R5]

Fix the whole data path, not just the evaluator function argument.

- Distinguish opponent decision scores from neutral review results. Opponent scores must never qualify as neutral cached analysis.
- Keep the current neutral evaluator as the initial reviewer behind a replaceable interface. Do not equate neutrality with independently proven review strength.
- Store sufficient provenance: analysis purpose, reviewer/version, search policy and completed depth or equivalent quality information. Preserve the White-perspective score convention.
- Separate position identity from analysis-cache identity. Include relevant rule state and history where supported; do not reuse a repetition key as though it described every condition affecting analysis.
- Review a move's before/after positions under comparable neutral settings. Expose preliminary/incomplete status when confidence is inadequate.
- Recompute dependent annotations when neutral analysis changes. Do not manufacture a verdict for an unevaluated or cancelled position.
- Treat old evaluations with unknown provenance as untrusted derived data. Invalidate/recompute their review annotations without altering moves, results, clocks, rating receipts, or existing story content. Preserve unreadable originals and recovery behaviour.
- Tag and cancel analysis by request, game, revision, purpose and relevant version. Undo, new game, account change, cancellation, worker restart and unmount must reject stale results.

**Required independence tests:**

1. At identical board/history and deterministic neutral search settings, changing personality IDs or weights does not change neutral scores, best moves, or annotations. Use controlled clocks/nodes for reproducible assertions; do not demand identical wall-time-limited results under differing machine load.
2. A deliberately biased **test-only** evaluator selects a verified inferior move while the neutral reviewer identifies its defect at the fixture's documented threshold. Do not require a production personality to keep making that mistake.
3. Opponent work followed by review, worker reuse, persisted caches and restored games cannot transfer personality scores into neutral judgments.
4. Reanalysis can change an earlier annotation. Cancelled or stale reanalysis cannot change the current game.

If timing out against a bare king still awards the bare king a win, reproduce and fix that unambiguous case with regression tests. Preserve other established draw conventions and human-game behaviour; do not silently claim complete tournament adjudication or introduce an unverified universal insufficient-material shortcut.

### A2. Implement the Paul Morphy profile

Use stable, non-brand-dependent behavioural IDs such as `attack-development`, `control-method`, and `counterplay-imagination`. Keep a `classic` identity for pre-existing computer games. Display metadata maps these IDs to the selected full names.

Persist enough opponent configuration to preserve the challenge after reload: profile ID/version, difficulty, engine/configuration version and relevant random state or seed policy. A display-name change must not split rivalry records. Behavioural changes must be versioned. Never silently replace an unavailable old configuration while describing it as the same rated opponent.

- Make personality explicit at search boundaries. Do not mutate a global evaluator or shared material values.
- Workers receive serializable identifiers/configuration and construct evaluators internally. Do not attempt to post functions or closures across the worker boundary.
- Add only the features needed for a credible Morphy prototype: active development, useful open lines, initiative and pressure against the correct enemy king. Explain each feature's sign, scale, and phase applicability.
- Bound personality influence. Avoid unconditional material discounts, raw capture-count rewards, or sacrifices without compensation. Tactical safety is not optional, though shallow search is not a guarantee of perfect play.
- Personality should influence suitable opening-book choices as well as later play. Reweight existing legal continuations without editing or corrupting the 185 retained lines. Keep original replies and fallback behaviour available. [R6]
- Respect time budgets, legal-move validation, terminal states, cancellation, and minimum reply timing. Account for any extra safety-search work inside the budget.
- Difficulty is chosen before a game and remains fixed. No hidden midgame assistance. Initially preserve the existing Classic difficulty policies rather than retune everything.
- In forced positions all personalities may correctly play the same move. Do not reward differences for their own sake.

Add a small, explained fixture set with attacking choices, development, defended targets, adverse positions, winning simplifications, forced mate and only-legal-move cases. Include both colours and out-of-book positions. Add held-out examples and a few complete-game smoke tests. Twenty handpicked positions alone do not establish historical fidelity, overall strength, or entertainment value.

Do not expose nonfunctional Steinitz/Chigorin cards. Their finished behaviour belongs in Milestone B.

### A3. Ratings: preserve progress; no invented calibration

A3 is mandatory before Run 2 exposes a playable personality. It is not deferred together with rivalry presentation.

Change the user-facing computer label to **Practice Rating** where appropriate. Keep 1v1 rating separate and unchanged. Explain that Practice Rating measures performance within this app.

Preserve existing Classic rating mathematics, floor, K policy, historic receipts, hint/takeback exclusions, undo reversal and exactly-once settlement. Do not rename internal legacy keys unnecessarily.

**Implementation default for this first local beta:** new personality games are unrated until calibration is reviewed. Show “Unrated beta — opponent calibration pending.” Existing Classic rated practice remains available. This is a temporary beta safeguard, not the removal of the rating feature.

Represent the reason explicitly; do not make the UI falsely say a hint or takeback caused an unrated beta game. Store rated eligibility and its reason with the game. Do not retrospectively rate beta games after calibration or count them in public rated leaderboards. Keep assisted and unassisted rivalry records distinguishable.

After measured calibration is approved, future games can use a versioned opponent rating under the existing formula. Completed games retain their original calibration context. Changing a name or profile must not reprice old results.

### A4. Save identity, replay games, and create the rivalry record

**Split by dependency, not by heading:** implement identity/configuration persistence, compatibility, owner isolation, and preservation of existing terminal/archive behaviour in Run 2. Defer new guest archive expansion, rivalry aggregates, and new replay/rivalry presentation to Run 3 where possible. Preserve all existing archive behaviour in every run.

Extend the existing game/archive structures with the minimum necessary opponent metadata. The baseline archive has no personality identifier, so do not assume a rivalry screen is just a filter over an existing field. [R7]

- Add a bounded guest game history as needed, separate from account-owned records. Reuse account archives rather than create a competing cloud truth.
- Archive results and replayable moves with stable game IDs, opponent/configuration versions, difficulty, colour, rated/assisted status, outcome and completion time.
- Scope the initial history to a documented retention bound consistent with the existing account limit of 200 completed games. Avoid inflating every active snapshot with the entire archive or breaking its request-size limit. [R7]
- Show honest wording such as “recorded games” or “recent record” when counts cover retained history. Do not claim lifetime totals or a first-ever victory from an incomplete archive.
- Compute W/D/L and recent results per profile and comparable difficulty. Mixed-difficulty totals must be labelled, not presented as an improvement trend.
- Store and aggregate terminal outcomes idempotently. Reload, retry and cross-device sync cannot duplicate a win. Undo of a finished game must remove or revise the corresponding terminal record consistently; later recompletion must not double-count it.
- Reconstruct archived games by legal replay using validated data. Never treat imported or stored HTML/text as executable content.
- Keep guest history separate on login. No automatic import into an account and no visibility into a previous account's games.
- Retain conflict detection, pending terminal saves, ownership checks, corrupt-save preservation and recovery choices.

Migrate missing personality fields to `classic`, not Paul Morphy. Historical games are not evidence about a personality that did not exist when they were played.

Version and test schema changes across local saves, persisted pending sync items, server validation, API responses, and archives. Migration must be deterministic and idempotent, preserve rating receipts, and handle mixed old/new clients safely. Never reset to a fresh game because a parser was not updated. An old client must not silently overwrite new fields or a newer schema. Document compatibility and rollback constraints before any deployment.

### A5. Integrate the UI without redesigning the app

Run 2 needs only selectable, correctly labelled, safely resumable Morphy play and accurate unrated status, using the existing board and review. New rivalry screens, richer result layout, and enhanced rematch integration belong in Run 3.

- Make Paul Morphy selectable in the existing setup flow, separately from difficulty, colour and time control.
- Keep resume immediate. Do not put onboarding, biographies or a course screen ahead of an active game.
- Use the full display name, “Attack & development,” and a brief simulation description. Keep any biography optional and source new historical prose before displaying it.
- Keep board/player labels consistent under both colours and board flipping.
- Add a compact private rivalry view with results, recorded games, replay and rematch. Place it within the existing account/game UI where appropriate; do not build a new dashboard framework.
- A rematch retains profile and difficulty and creates a new game ID. Keep the existing colour by default and let the player change it; do not silently reinterpret old wins under new settings.
- Result screen priorities: result, rating change when eligible, rivalry record, **Rematch**, **Review**, **New game**. Explain unrated beta status without a misleading zero-point result.
- Existing optional move stories and review remain available. A turning-point link is permissible only when comparable neutral analysis supports it; otherwise omit it or label the analysis incomplete.
- Do not add causal narratives such as “this weakness lost three games.” Milestone A's rivalry feature reports outcomes, not inferred causes.
- Preserve keyboard use, focus handling, dark/wood themes, reduced motion, audio controls, and narrow-phone layouts. No forced green accents, modal overload or generic UI redesign.

### A6. Enable locally, verify, and report

The execution and verification record requirements apply from A0 in every run. Implement and test the default-off beta flag before any new opponent can be selected in Run 2; do not wait until all A sections are finished. Run 1 may correctly report that no personality beta exists yet.

Use an explicit local/beta capability switch, default off for an ordinary production build. Document its exact name and how to enable it for testing. It must not bypass authorization or data validation. Do not add secrets to frontend environment variables.

A disabled feature flag must not orphan an already-saved beta game: support safe resume or a clearly explained read-only/recovery path without damaging progress. Never substitute Classic silently.

Write a concise report with the actual commands run, changed files, test results, migration behaviour, known limitations, and exact local testing instructions. Screenshots and logs must use synthetic data. Do not label the first slice release-ready while naming clearance, calibration or device checks remain pending.

## 5. Mandatory regression and acceptance matrix

This is the full Milestone A completion gate. Existing-behaviour regressions apply throughout. In Run 1, unimplemented Morphy/rivalry requirements are explicitly `deferred`, not failed tests or completed features. Run 2 must satisfy every safety dependency for playable Morphy, while new rivalry/replay UI can remain deferred. Run 3 evaluates the whole matrix. Never label the full milestone complete merely because tests for the smaller selected run are green.

| Area | Required evidence |
|---|---|
| Existing play | Classic computer play, legal rules, both colours, terminal handling, clocks, promotion, elapsed-time catch-up and the existing minimum reply delay remain correct. |
| Independent review | The four A1 checks pass, including saved-cache provenance and annotation replacement. |
| Morphy behaviour | Explained fixtures show useful preferences where choices exist; forced safety cases remain correct; out-of-book play and deadlines work. |
| Persistence | Old saves become Classic without losing progress; Morphy resumes with its configuration; corrupt/unknown data is not overwritten. |
| Rivalry | W/D/L and game replay work for guests and accounts; terminal retries, undo, restart and recompletion do not duplicate results. |
| Rating | Classic receipts survive migration unchanged; beta games do not alter rating; unrated reasons are accurate; human ratings are unaffected. |
| Account isolation | Logout/login, stale tabs, conflict resolution, offline pending writes and archive access preserve ownership. |
| Worker lifecycle | Cancel/restart/unmount cannot apply a stale move or review; failures retain the existing recovery behaviour. |
| Multiplayer | Invite/join, authoritative moves, H2H, temporary chat and notification ownership remain unaffected. No real notifications in tests. |
| PWA | Cached offline guest reopening includes profile assets and engine code; safe updates preserve active play; old and new schema interactions are tested. |
| UI | No horizontal overflow at representative phone widths; keyboard/focus/reduced-motion checks and accessibility checks remain passing. |
| Failure handling | Storage quota, offline sync, API failure and feature-flag changes produce recoverable states rather than silent resets. |

Use the current scripts, confirmed from `package.json`. At the inspected baseline these are: [R8]

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:browser
git diff --check
```

Use `.nvmrc` and the locked dependency install when needed. Run `npm run test:accessibility` against the documented local preview setup. Do not point tests at production or an existing personal database. Update lint/format/test inclusion for new modules; a new folder outside the current scripts is not automatically covered.

Run focused tests during development, predeclared checks at each checkpoint, and the existing full suite at each run boundary before claiming full verification of that run. The complete milestone additionally requires the full acceptance matrix. Explain every skipped or blocked check and identify pre-existing failures separately. Do not remove meaningful assertions, suppress failures, or claim the historical passing counts as newly executed evidence.

Browser automation should exercise Chromium and relevant WebKit journeys where available. Record simulator, automated browser, real-device, and owner-reported evidence separately. If an iPhone is unavailable, mark physical sound/install/performance checks **pending**, not passed.

## 6. Subsequent milestones: preserve direction, do not implement everything at once

### Milestone B — Complete the roster and measure strength

After Milestone A is working, implement Steinitz and Chigorin using the same registry, persistence and review boundaries. Validate distinctiveness at comparable strengths, not merely different portraits or opening moves.

Build a resumable, reproducible local match harness with bounded game/ply/runtime limits. Use varied held-out opening pairs, both colours, deterministic seeds, actual shipped search budgets, all intended difficulties and more than one reference configuration. Record W/D/L, failed games, configuration/hardware, completed work and uncertainty. Run only a small smoke batch automatically; no unbounded overnight job by default.

Self-play yields relative performance on an internal scale. Do not call it FIDE/chess.com/Lichess calibration. A small sample may justify “inconclusive.” Check whether more games or additional opponents are needed before distinguishing nearby levels. Version all proposed ratings and submit the results before applying them to future rated play.

Add PGN export, followed by bounded, validated import and review in a separate analysis context. An imported game must not mutate live ratings, competitive results or an active match. Do not present PGN as a full application backup.

### Milestone C — Early iOS compatibility experiment

Schedule this after the first complete PWA slice, while wider PWA testing continues. It must not wait for an extensive feature catalogue, and must not turn into a native rewrite.

Evaluate Capacitor using the current compatible tooling. Bundle the built UI, engine and essential assets rather than just display the hosted website. Check actual engine-worker operation, offline launch, API configuration, authentication, persistent storage, account restoration, sound, lifecycle/resume, safe areas and invitation links. Check native notification integration separately from browser push.

The current relative API/cookie/origin assumptions and browser storage are integration boundaries, not portable guarantees. Do not broadly relax CORS, CSRF/origin, cookie or ownership controls to make a native test pass. Never place session secrets in ordinary browser storage for convenience. Establish secure transport/storage deliberately. [E2–E3]

Keep platform operations behind small interfaces for networking, persistence, lifecycle, links, notifications and optional haptics. Do not refactor the entire application in anticipation of hypothetical needs. Maintain the PWA's normal service-worker path separately from the packaged build as appropriate.

If Xcode, signing or a physical device is unavailable, complete the inspectable work and state exactly what was not run. Simulator success does not establish physical-device performance or audibility. No store upload, account enrollment or subscription purchase is authorized here.

### Milestone D — Broader beta and release preparation

Before widening access, review remaining account recovery, verified notification destinations, deletion/export, chat reporting and privacy requirements; establish off-server backup and restoration evidence. Recheck applicable store and licensing requirements against current official sources. These are separate release work items, not new scope inside Milestone A.

For stronger review, record a decision with owner, status, evidence needed and a review checkpoint: retain/improve the current engine, embed a compliant third-party reviewer, or use a separately approved alternative. No assumed GPL clearance, hidden network analysis, or invented strength threshold. Reviewer-only Stockfish remains an option to assess, not preapproved implementation.

Later rivalry observations must link to specific game/move evidence, distinguish a detected motif from a cause of defeat, and distinguish absence of an opportunity from successful defence. Do not store public personal-game data or manufacture progress claims.

Test behaviour before adding curricula, voice narration, numerous bots or social features. Naming clearance applies to public web use as well as a future store release.

## 7. Measuring whether the product works

Document event definitions now, but do not add external analytics or change data collection in this first pass. A local diagnostic adapter or synthetic test event sink is enough initially. Any later aggregate collection needs a deliberate privacy and retention decision.

Primary measures:

1. **Rematch after a loss:** same profile/version and comparable difficulty, with a defined session/window and denominator.
2. **Next-week return:** a defined cohort of players who completed a game, measured consistently; acknowledge guest identification and device limitations.
3. **Reliable progress:** completed games and rating/rivalry records survive reload, interruption and synchronization without loss or duplication.

Secondary evidence: voluntary review use, game completion, perceived opponent differences and neutral-review benchmark quality. Fixture pass rates are release checks, not proof of retention. Do not select thresholds after seeing results just to declare success.

## 8. Required output from every Codex execution

The first run delivers the A0/A1 reviewer foundation, not the entire Morphy milestone. Deliver a tested implementation of the selected run where possible, reviewable local checkpoint commits, and an accurate account of any unfinished work. The completion report must state:

- Selected run and status of each checkpoint: verified, blocked, in-progress, or deferred. State what works and exact run instructions; provide beta enablement only when a beta actually exists.
- Branch/worktree, starting base SHA, final HEAD, verified checkpoint SHAs and subjects, and any task-only uncommitted changes. Report preserved pre-existing changes separately.
- What changed, with file references and any narrow scope-document amendments. Include the actual execution and verification record paths.
- Checks actually run, pass/fail/skip counts and environment limitations.
- Evidence that review is independent and legacy games/ratings are preserved.
- Data migration, retention and rollback behaviour, including pending offline writes.
- How to reproduce the checks relevant to the selected run. For Run 1, show reviewer independence and legacy restore. For Run 2, add Morphy play, flag behaviour, unrated status and save/resume. For Run 3, add archive replay, rivalry and rematch.
- Whether the workspace is persistent or disposable; any recovery export paths, contents and base SHA; and whether those artifacts were actually made available to the owner.
- Outstanding items, especially calibration, rights, stronger review and physical iPhone verification.
- The next bounded task. Do not begin deployment, purchasing, iOS packaging or unrelated scope automatically.

Keep the execution record current throughout work and before a voluntary stop. Identify the next exact task and prerequisites so a later session can resume without reconstructing the plan. Do not ask for the naming, product hierarchy or PWA-first choice again. When a dependency is blocked, continue only safe independent work within the selected run; do not bypass the reviewer gate or expose an unsafe beta. Stop at the declared run boundary even when remaining work is tempting. Never report local commits as remote backups or claim that unperformed checks passed.

## Source and verification notes

Repository references below use the inspected baseline commit, not an assumption that the local checkout is identical. These are evidence pointers, not instructions to overwrite newer code.

- **R1:** `AGENTS.md` and `CODEX_HANDOFF.md`. Existing invariants and test workflow; the older handoff explicitly retains a historical prototype plan.
- **R2:** `VISION.md`, `PRODUCT.md`, `README.md`. Prior scope, styling, content preservation, account and multiplayer boundaries.
- **R3:** `src/game/useGame.ts`, specifically opponent-score dispatch and the review loops. Observed mixed evaluation store and skip-existing behaviour.
- **R4:** `src/coach/annotate.ts`, `annotateAll`. Observed early return for non-null annotations.
- **R5:** `src/game/types.ts` and `src/coach/types.ts`. Version-1 session shape, setup fields and provenance-free evaluation records at baseline.
- **R6:** `src/engine/eval.ts`, `src/engine/search.ts`, `src/book/`. Existing evaluation and book-first opponent selection; proposed style features still need implementation and measurement.
- **R7:** `server/records.ts`, `src/storage/schema.ts`, `src/account/sync.ts`. Archive fields and retention, snapshot bounds, replay validation and synchronization contracts.
- **R8:** `package.json`, `.nvmrc`, `playwright.config.js`, `.github/workflows/ci.yml`. Verify actual commands and runtime locally before execution.

Canonical repository source pattern:

```text
https://github.com/clauding-lab/chess-prodigy/blob/f2b45b701795ea2aa03e89688ced04b8106b5928/<path>
```

External guidance recorded for the original handoff on 11 September 2026 (E1 rechecked for revision 2; E2–E3 retained as earlier references):

- **E1 — OpenAI, project instructions:** `https://developers.openai.com/codex/guides/agents-md` (redirected to `https://learn.chatgpt.com/docs/agent-configuration/agents-md`). Retain applicable AGENTS instructions and point explicitly to this task brief; do not replace project guidance wholesale.
- **E2 — Capacitor, existing web applications and configuration:** `https://capacitorjs.com/` and `https://capacitorjs.com/docs/config`. The iOS experiment is a later integration task, not a guarantee of automatic portability.
- **E3 — Capacitor, Preferences:** `https://capacitorjs.com/docs/apis/preferences`. The guidance distinguishes lightweight preferences from database storage and warns about mobile web-storage persistence.

Revision 2 additional guidance checked on 11 September 2026:

- **E4 — Git, bundle documentation:** `https://git-scm.com/docs/git-bundle`. Git supports offline transfer/backup of committed objects and references. A bundle does not include ordinary uncommitted working-tree or index content; a recovery export must account for those separately. An export must be retained outside an ephemeral workspace to protect against its removal.
- **E5 — OpenAI, worktrees:** `https://developers.openai.com/codex/app/worktrees` (redirected to `https://learn.chatgpt.com/docs/environments/git-worktrees`). Inspect the actual checkout/worktree and branch; do not assume an agent is working directly in the owner's normal checkout.

**Final instruction: implement Run 1 now: A0 + A1 + a checkpoint report. Write the record before application-code edits, commit verified checkpoints locally on a feature branch, and stop before Morphy implementation. Preserve the end-to-end Milestone A goal for the subsequent bounded runs; do not replace implementation with another strategy document.**
