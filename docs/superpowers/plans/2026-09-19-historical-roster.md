# Historical Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkboxes for tracking.

**Goal:** Add exaggerated, historically grounded Spassky, Tal and Fischer alongside measured Chigorin.
**Architecture:** New pure per-player policies share new bounded-search/position-feature helpers and
source-validation tools, without changing existing playing policies. Separate per-player workers
keep unused repertoires out of active worker startup; versioned saves and account policy5 protect
new identities. Each frozen policy is measured separately before rated activation.
**Tech Stack:** TypeScript, React, Vitest, Playwright, existing custom engine and SQLite account server.
**Spec:** docs/superpowers/specs/2026-09-19-historical-roster-draft.md (approved19September2026BDT).

## Global Constraints

- Exact IDs spassky/tal/fischer, version1, engines spassky-plans-v1/tal-plans-v1/fischer-plans-v1,
  randomPolicy seeded-per-ply-v1 and uint32 seed. No old policy/repertoire/receipt changes.
- Neutral-loss guards100/150/50centipawns and maximum bonuses240/360/240 respectively.
- Production depth/time1/200ms,2/600ms,4/2000ms with30ms ranking reserve inside deadline.
- Historical legal recorded moves weighted by exact occurrence counts; no borrowed book.
- Guest state-v7/account-v7/history-v6; preserve all previous recovery keys/pending versions.
  Wire schema2; permanent minimum account policy5 after any new identity, including assisted games/reset.
- Dark default; direct Wikipedia cards without dropdowns; safe Home/Resume, clocks, offline updates.
- No Stockfish/paid services/live player data. Do not publish measurement guesses.
- Source and app commits local during construction; no additional GitHub release tag requested.

## Task1: Historical corpora and distinct playing engines

**Files:** Create scripts/roster-history/{corpus,import,behaviour}.ts;
src/engine/roster/{types,book,features,policy,spassky,tal,fischer}.ts;
src/book/{spassky,tal,fischer}-book.json; tests/engine/roster-{corpus,behaviour}.test.ts;
docs/verification/roster/{sources,behaviour-protocol,behaviour-report}.md plus retained source evidence.
Only new files for this task; existing engine/Chigorin corpus files are read-only references.

**Interfaces:**
```ts
type RosterId = "spassky" | "tal" | "fischer";
type ChooseRosterMove = (position: Position, level: Level, seed: number,
  ply: number, now?: () => number) => AiResult;
// Per-player modules export chooseSpasskyMove / chooseTalMove / chooseFischerMove.
// Each also exports explainSpasskyMove / explainTalMove / explainFischerMove:
interface RosterDecision {
  result: AiResult; plan: string; depth: number; neutralLoss: number;
  bonus: number; reason: "book"|"terminal"|"mate"|"plan"|"neutral"|"incomplete"|"deadline";
}
```
- [ ] Declare both-color off-book FEN cases and expected multi-turn priorities before implementing
  coefficients: Spassky buildup then centre/attack; Tal compensated sacrifice versus an unsound offer;
  Fischer useful bishop/open-file pressure and favorable conversion versus harmful trades.
- [ ] Write missing-module/behavior tests, e.g. `expect(explainTalMove(trap,"strong",7,0).neutralLoss)
  .toBeLessThanOrEqual(150)` and assert actual selected moves exhibit the declared progress.
- [ ] Obtain PGN Mentor catalog download targets, preserve original bytes/hash/date. Parameterize new
  parser for exact player names, retaining duplicate/illegal/nonordinary exclusions. Reuse concepts
  from Chigorin parser without modifying that frozen implementation.
- [ ] Verify full legal histories, terminal handling, exact compact-key collision freedom and all book
  moves/frequencies. Heavy corpus replay runs asynchronously in a child process to keep Vitest responsive.
- [ ] Implement per-player policies in Spassky/Tal/Fischer order. New common neutral candidate wrapper
  discards incomplete depths/rankings, prioritizes complete mate, enforces exact loss/bonus/deadline bounds,
  and uses deterministic seed/position/ply choice. Pinned pieces cannot earn fictitious legal reach.
- [ ] Book selection checks legal recorded moves, preserves full occurrences and terminal semantics.
  No strength tuning based on later calibration outcomes.
- [ ] Run new focused tests + standalone full corpus/behavior checks; retain diagnostics/source facts.
  Commit scoped files. Independent code/spec/behavior review before integration freeze.

## Task2: Exact identities, worker routing, safe storage and calibration

**Files:** Modify src/engine/opponents.ts, src/worker/client.ts, src/storage/{store,history}.ts,
src/account/sync.ts, server/records.ts, src/rating/opponents.ts, src/ui/{Home,Modals,RecordedGames}.tsx,
src/App.tsx, vite.config.ts, scripts/calibration/{protocol,match,run}.ts, package/TypeScript/lint
configuration for new checked scripts. Create src/engine/roster/{dispatch,worker}.ts and
src/engine/{spassky,tal,fischer}.worker.ts; tests/{worker,game,storage,account,server,ui,calibration}/
roster-focused tests and tests/browser/roster.spec.ts.

**Interfaces:**
```ts
export function rosterConfig(id: RosterId, seed: number): OpponentConfig;
export function chooseRosterOpponentMove(position: Position, level: Level, bookSans: string[],
  opponent: OpponentConfig, ply: number, now?: () => number): AiResult;
// dispatch calls Task1 per-player functions for exact new identities, old chooseOpponentMove otherwise.
// No new imports in old Morphy/Chigorin playing code (src/engine/morphy.ts remains unchanged).
export const ROSTER_RATINGS: Readonly<Record<RosterId, Readonly<Record<Level,number>>|null>>;
```
- [ ] Test exact config validation, unknown versions/random policies/seeds; initially all new ratings
  null, normal setup unavailable and no new identity rated.
- [ ] Add worker factory selection by request opponent. Each new worker handles only its exact AI
  identity; old worker remains for old opponents and neutral reviews. Preserve request/game/revision
  identities, retry/error paths and terminating cancellation. Test late replies after cancellation.
- [ ] Advance authority locations preserving every old recovery/pending overlay. Add tests starting
  from v6 and older guest/account/history snapshots; corrupt current data still blocks overwrite.
- [ ] Server derives ownership from session, maps any new identity to permanent floor5; test assisted
  save, reset, restart, stale client, unknown configuration, exact legacy raw acknowledgement.
- [ ] Home/setup/history/rematch show precise player identity and brief exaggerated-priority copy;
  direct Wikipedia links. Until measurements accepted, no normal setup/rated rematch for new identities.
- [ ] Add protocols spassky-plans-paired-v1, tal-plans-paired-v1, fischer-plans-paired-v1. Manifests bind
  exact identity and all influencing source/book/config files; production Node dispatch uses same pure
  policy functions as dedicated workers. Preserve old protocols/seed/START behavior.
- [ ] Raise explicit per-file offline cap to8MiB only with measured per-player assets under that cap.
  Enabled/default builds and real native worker/offline saved-game checks must pass. Do not drop data.
- [ ] Run focused integration/security/worker tests, typecheck/lint/format/build. Independent review;
  preserve all old identities and review policies. Commit before source freeze.

## Task3: Freeze and independently measure each opponent

**Files:** Retained run directories outside worktree and docs/verification/roster/{PLAYER}/calibration;
measurement reports, independent audit code/results, source inventories and checksums.
- [ ] Verify playing source and dependencies, create immutable git archive and complete SHA256 inventory.
  Record actual Node/machine/concurrency. Never mutate frozen source while measuring.
- [ ] Measure Spassky then Tal then Fischer, one level at a time. Eight pair workers,50pairs from START,
  full games/color swaps/seed `(0x20260912 + pair*7919) >>> 0`,1000ply bound, no adjudication.
```sh
node --import tsx scripts/calibration/run.ts LEVEL EVIDENCE 50 1000 PROTOCOL --init-only --concurrency=8
# Start only declared missing pair IDs0..49 with worker.ts LEVEL EVIDENCE PAIR PROTOCOL.
node --import tsx scripts/calibration/run.ts LEVEL EVIDENCE 50 1000 PROTOCOL --verify-only --concurrency=8
```
- [ ] Preserve50summary; only if ineligible extend50..99, then100..199 if still required. Stop each
  level at first eligible50/100/200checkpoint. If200fails withhold that opponent; never retune/rerun
  eligible levels. Record exact evidence rather than changing acceptance criteria.
- [ ] Independent reviewer derives statistics without importing estimator, legally replays outcomes,
  checks source identities and pair sets/seed/colors/logs/checkpoints. Explicitly distinguish trusted
  local execution provenance from legal replay assurance; no claim of deterministic timed search replay.
- [ ] Pack every synthetic game in compressed JSONL plus source/line hash map; independently verify pack.
  Only accepted nearest25 values may proceed to Task4. No guessed human/FIDE or perceived-style claims.

## Task4: Activate, verify and finish the roster

**Files:** src/rating/opponents.ts, src/engine/opponents.ts rating eligibility only; targeted UI/game/
browser tests, README/CHANGELOG/AGENTS/VISION/version and docs/verification/roster/integration-report.md.
- [ ] Change tests first from gated to exact accepted ratings, including hints/takebacks unrated,
  single receipts/undo, retained-history counts, rematches, saved identity and policy5 rejection.
- [ ] Enable only independently accepted exact opponent identities; do not change playing source.
- [ ] Verify actual app for every player/difficulty/color; guest/account, offline worker reload, coaching,
  cancel/retry, forfeit/resume, clocks, history/replay/rematch and screen-reader/keyboard navigation.
- [ ] Run all tests, typecheck/lint/format, enabled/default build/browser matrices and accessibility
  in both themes. Inspect actual Home cards and play screenshots; emulate mobile without claiming
  physical-device evidence. Include root Morphy card simplification and measured Chigorin.
- [ ] Independent whole-branch TypeScript/security/spec review; resolve findings, retain test evidence
  and honest measurement limits. Commit verified candidate. Report source/live status distinctly.

## Preflight rulings

New engine code is implemented and reviewed in player order before a shared integration freeze,
then measurements run in that same order. This avoids changing shared runtime infrastructure between
three freezes; each opponent retains a separate source-bound protocol, evidence and activation gate.
No interim app exposing a partly supported policy5 identity is published.
The existing Chigorin completion is a prerequisite and stays in its own branch until locally verified.
