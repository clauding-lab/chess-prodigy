# Morphy Playing Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship a verified and freshly measured Morphy-inspired opponent directly in the actual app.

**Architecture:** Preserve the recorded book and all old policies; add complete-depth neutral root
alternatives plus a position-derived plan selector for version4/plans-v1. Measure that frozen playing
policy, then integrate its fixed ratings/current setup and safe storage/account generation in the app.

**Tech Stack:** Existing TypeScript custom engine, React, Vitest, SQLite/Better Auth, Vite PWA.

**Spec:** docs/superpowers/specs/2026-09-12-morphy-plans.md

## Global Constraints

- Version4 is attack-development/plans-v1/seeded-per-ply-v1. Visible name stays Paul Morphy.
- Preserve exact v1/v2/v3 policy bodies, book/model/corpus bytes and rating values/receipts.
- No failed experimental model, Stockfish, paid service or live player data.
- Full-depth neutral root scores; common elapsed budget;100cp safety screen; plan influence<=240cp;
  forced mates and complete neutral fallback take priority. No extra production thinking time.
- No durable beta-v4 user games before fresh fixed strength values; existing setup remainsv3 until then.
- New authority state-v5/account-v5/history-v4, retaining all recovery keys. Account floor3 permanently
  after acceptingv4, including assisted/reset. Header literals1/2/3 only. Wire remains2 with exact acks.
- Preserve permanent dark default, Home/Resume/clocks, neutral review, content and private ownership.
- Existing-host deployment/push authorized after verification; no extra release tag.
- Every fresh Node shell: `source ~/.nvm/nvm.sh && nvm use >/dev/null` (Node22.23.0).

### Task 1: Actual engine policy, behavioural evidence and calibration harness

**Files:** Create src/engine/morphy-plans.ts, tests/engine/morphy-plans.test.ts,
tests/engine/root-candidates.test.ts, scripts/calibration/plans-behaviour.ts,
docs/verification/morphy-plans/behaviour-protocol.md and behaviour.json/report. Modify additively
src/engine/search.ts, opponents.ts, morphy.ts, scripts/calibration/{protocol,match,run,worker}.ts,
tests/calibration/matches.test.ts and exact unsupported-version fixtures in tests/game/opponents.test.ts
and tests/game/rated-morphy.test.ts only as required by supporting-unratedv4. Do not change setup,
rating tables, storage, server, old function bodies or unrelated tests.

**Interfaces:**
```ts
// search.ts: candidate.score is mover perspective; fallback.score is White perspective.
export interface RootCandidates {
  candidates: { move: Move; score: number }[];
  depth: number;
  fallback: SearchResult;
  timedOut: boolean;
}
export function searchRootCandidates(position: Position, maxDepth: number, ms: number,
  now?: () => number): RootCandidates;
// morphy-plans.ts exposes pure plan/progress and a detailed decision for tests/diagnostics.
export type MorphyPlan = "develop" | "open-centre" | "king-attack" | "active-pieces";
export function choosePlannedMove(position: Position, level: Level, seed: number, ply: number,
  now?: () => number): AiResult;
// opponents.ts
export function plannedMorphyConfig(seed: number): OpponentConfig;
```
Detailed diagnostic return names/types are owned by this task and documented in its report before
later consumption. Runtime worker dispatch consumes only AiResult, unchanged request identities.

- [ ] Write actual-choice and complete-depth tests first, including the following real positions
  and their colour-reflections. Keep fixture identities/expected chess properties in the protocol
  before implementing policy expectations; then run focused tests and record the expected failure.
```ts
const mate = fromFEN("7k/8/6K1/6Q1/8/8/8/8 w - - 0 1");
const selected = choosePlannedMove(mate, "club", 1, 24, () => 0).move!;
expect(sanFor(mate, selected, applyMove(mate, selected))).toBe("Qd8#");
const freeQueen = fromFEN("4k3/8/8/8/8/8/q7/R3K3 w - - 0 1");
// Assert actual queen capture, not just a legal move. Also add poisoned-capture/recapture fixtures.
```
  Tests must cover zero
  budget, expiry halfway through an iteration, retained previous complete iteration, forced mates,
  endgame neutral fallback, terminal no-move, legal recorded openings and seeded replay.
- [ ] Add searchRootCandidates using private existing neutral search helpers and full windows at
  every root alternative. Preserve existing public/private policy behaviour; clear transposition
  state between complete root alternatives if needed to avoid stale bound contamination. Publish
  candidates only after the entire iteration completes; no mixed depths or plan-ranked partials.
```ts
// Required invariant exercised against real complete alternatives:
expect(result.candidates.every(c => legalMoves(position).some(m => sameMove(m,c.move)))).toBe(true);
expect(new Set(result.candidates.map(c => `${c.move.from}:${c.move.to}:${c.move.promo}`)).size)
  .toBe(legalMoves(position).length);
```
- [ ] Implement pure position-derived plan modes/progress and bounded root ranking per spec. Freeze
  exact activation conditions, feature definitions, numerical weights and tie policy in the retained
  behaviour protocol before calibration. Add actual multi-move fixtures for development, central
  opening and coordinated attack. Neutral safety must override poisoned captures or cosmetic checks;
  account for pinned/non-contributing attackers in plan features. Expired plan evaluation returns
  complete neutral result. Preserve exact recorded opening selection without invoking v3 off-book
  search accidentally. Dispatch exactv4 only; v4 supported but unrated here.
- [ ] Add distinct calibration protocol morphy-plans-paired-v1 with exactv4/plans-v1 and START.
  Preserve old protocol mappings. Add influencing new source files to fingerprints. Extend exact
  identity mismatch, wrong opening, resumed worker, legal replay and source mismatch tests.
```ts
expect(opponentIdentity(PLANS_PROTOCOL)).toEqual({id:"attack-development",version:4,
  engine:"plans-v1",randomPolicy:"seeded-per-ply-v1"});
expect(openingForProtocol(PLANS_PROTOCOL,123)).toEqual([]);
```
- [ ] Run focused tests then typecheck/lint/format, retaining results. Run full-policy diagnostics
  with actual decisions, progress/neutral loss/completed depth/fallback and descriptive Classic
  comparison. Include predetermined both-colour off-book positions and multi-turn traces. Report
  observed purposeful changes without claiming a human-perception pass. Commit source/report for
  independent spec/TypeScript/search review before measurement. Do not fit another historical model.

### Task 2: Frozen complete-game strength measurement

**Files:** New docs/verification/morphy-plans/calibration-20260912/ bundle and measurement-report.md;
frozen source/evidence archive in a new task-specific Downloads folder. No playing-code edits.
Consumes Task1 PLANS_PROTOCOL and production chooseOpponentMove. Produces independently accepted
Casual/Club/Strong fixed values with raw games/manifests/checkpoints and source identity.

- [ ] Freeze reviewed source to a new directory/archive with full file hashes; install locked deps
  there under Node22.23.0. Use exactly8 configured pair workers (or fewer if machine has fewer CPUs,
  recorded before run), and no unrelated heavy work during timing-sensitive measurements.
- [ ] Initialize50pairs per level at START/max1000plies, then run pair workers0..49 with declared
  concurrency; preserve every result, unfinished game and log. Use exact commands:
```sh
node --import tsx scripts/calibration/run.ts casual "$RUN_DIR" 50 1000 morphy-plans-paired-v1 --init-only --concurrency=8
node --import tsx scripts/calibration/worker.ts casual "$RUN_DIR" 0 morphy-plans-paired-v1
node --import tsx scripts/calibration/run.ts casual "$RUN_DIR" 50 1000 morphy-plans-paired-v1 --verify-only --concurrency=8
```
  Repeat the exact protocol for club/strong. Use the frozen worker's real CLI contract if selectors
  differ; record the resolved commands before games. Aggregate only at50/100/200pair checkpoints;
  extend to next declared checkpoint only when ineligible. Stop at first eligible per level.
- [ ] Independently legally replay games and verify all source/manifests, pair seeds/colours, final
  results, checkpoint intervals and nearest25rounding. Preserve old calibration data untouched.
  No extrapolation, adjudication or reusedv3values. If a level remains ineligible at200pairs, keep
  that level unrated and retain evidence rather than inventing a rating; adapt explicit UI semantics
  in the next task with a recorded ruling before integration.
- [ ] Commit compact raw-game evidence and report accepted values/limits. Do not change playing
  policy after freeze; code fixes require a new freeze and evidence directory, preserving old runs.

### Task 3: Actual-app rated integration and compatibility

**Files:** Modify src/rating/opponents.ts, src/engine/opponents.ts rated eligibility only,
src/ui/Modals.tsx, Home.tsx, src/storage/store.ts/history.ts, src/account/sync.ts,
server/records.ts and directly covering engine/game/storage/account/server/UI/browser tests.
Preserve src/game/state.ts, storage/schema.ts, account/records.ts semantics unless a tested exact
newversion boundary requires additive handling. No broad refactoring or new opponent menu.

- [ ] Tests first: v4newsetup/rating/hint/forfeit/receipt reload/undo; oldv3rematch retainsv3rating;
  oldgeneration migration preserves original bytes and pending account version; corrupt current
  authority prevents fallback. Verify minimumclientpolicy3 survives assistedv4, Classicreset and
  server restart; headers1/2 cannot overwrite afterfloor3, future/malformedheaders rejected;
  original wire acknowledgement stays exact.
```ts
expect(opponentPracticeRating(historicalMorphyConfig(1),"casual")).toBe(1275);
const draft = {color:"w",level:"club",time:0,opponentId:"attack-development"} as const;
expect(setupFromDraft(draft,true).opponent!.version).toBe(4);
expect(setupFromDraft({...draft,opponentVersion:3},true).opponent!.version).toBe(3);
```
  Use actual existing draft field names and test helpers; freeze accepted numericv4values from Task2
  in the task brief, never guessed numbers.
- [ ] Add acceptedv4rating table and isRatedOpponent support. Extend setup version mapping1/2/3/4,
  newdefaultv4. Current copy describes recorded openings and designed plans; savedv3joins older
  version notice. Keep earlier rematches and unknown-version blocking exact.
- [ ] Advance current keys tostate-v5/account-v5/history-v4, adding formercurrent to ordered recovery
  fallbacks. Header3 and permanent minimum3 after anyv4snapshot. Preserve transactional writes,
  ownership, original wire body, no downgrade, pending overlay ordering and isolation.
- [ ] Run covering tests/type/lint/format. Review the task independently including security-sensitive
  account fence and SQLite transaction behaviour. Playing source remains frozen except rated-config
  registration; demonstrate that accepted engine decisions/source bodies are unchanged.

### Task 4: Full app verification and existing-host delivery

**Files:** Relevant browser tests, release documentation and deployment records only; targeted fixes
return to their owner for reviewed repair. No extra release tag.

- [ ] Run full npm test/typecheck/lint/format, enabled and default builds. Browser checks use disposable
  account server, actualv4game/worker moves, oldv3resume/rematch, rated result/reload, assistedexclusion,
  recovery migration/accountfloor, Home/clocks, explicit update and offline guest reopening. Run both
  theme accessibility checks. Never present emulation as physical-device evidence.
- [ ] Request most-capable final whole-branch review of implementation/evidence/compatibility. Resolve
  real findings with regression tests and scoped re-review; do not repeat passed checks without reason.
- [ ] UpdateREADME/changelog/version as appropriate for the scoped app update, document measuredv4,
  preserveoldratings and no invented historical claims. Freeze/build liveenableflag true (literal
  string true, not1). Fast-forward/push main under standing authorization, no forcepush/tag.
- [ ] Deploy existing service with consistent private database backup and compatibleclientpolicy3,
  validate hashes/health and isolatedguestfreshsetup/move. No liveplayerdata inspection, no forced
  reload, no incompatible rollback. Report actual URL/version/checks and any remaining limits.
