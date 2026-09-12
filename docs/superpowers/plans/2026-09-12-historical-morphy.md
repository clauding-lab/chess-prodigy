# Historical Morphy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new Morphy games use his documented moves and tested historical preferences, with a separately measured Practice Rating.

**Architecture:** A build-time importer validates historical game facts and generates a compact position repertoire. A separate historical engine/model leaves style-v1 unchanged. Version-aware selection, receipts and client protections bind the new measurement to version 3.

**Tech Stack:** Existing TypeScript custom engine, React, Vitest, Playwright and SQLite; Node 22; no new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-12-historical-morphy.md`

## Global Constraints

- Preserve configuration versions 1 and 2 / style-v1 exactly, including their rematches and rating values.
- New opponent is attack-development version 3 / historical-v1. Do not rate or expose it as measured before accepted calibration.
- Use documented normal games only, legal replay and provenance; exclude odds/setup fragments and malformed records.
- No Classic opening fallback in historical-v1; retain neutral coaching, all 185 original opening lines and 27 coaching records.
- No Stockfish, paid service or live-player data; preserve account ownership, pending changes and recovery copies.
- Keep production depth/time limits and existing rating formulas. Full-game seeded colour pairs from START, 50/100/200-pair checkpoints and the existing <=300-width eligibility rule.

### Task 1: Validated historical corpus and repertoire

**Files:** Create `scripts/morphy-history/corpus.ts`, `scripts/morphy-history/import.ts`, `src/book/morphy-games.json`, `src/book/morphy-book.json`, `tests/engine/historical-corpus.test.ts`; provenance in `docs/verification/morphy-history/README.md`.

**Interfaces:** `HistoricalGame { id: string; white: string; black: string; date: string; site: string; morphyColor: Color; moves: string[] }`; normalized moves are SAN. `parseHistoricalPgn(text: string): { games: HistoricalGame[]; excluded: { index: number; reason: string }[] }`. Repertoire JSON maps `posKey(position)` to arrays of `[uci: string, count: number]`, only at Morphy's own turns. Importer emits complete validated metadata/moves and a counts/exclusions manifest.

- [ ] Add failing tests with normal long-algebraic and SAN sequences, castling/promotion, comments, setup/odds rejection, illegal trailing move and duplicates. Example: `expect(parseHistoricalPgn('[Event ""]\n[White "Morphy"]\n[Black "Opponent"]\n[Result "*"]\n1.e2-e4 e7-e5 2.Ng1-f3 *').games[0].moves).toEqual(['e4','e5','Nf3'])`.
- [ ] Legally resolve each token against `legalMoves`, `applyMove`, `sanFor`; exclude the entire record on illegal moves or unsupported notation. Use `START()` only and reject any SetUp/FEN/odds record. Exact player name Morphy selects Paul, not Alonzo Morphy.
- [ ] Deduplicate normalized move sequences plus Morphy colour; use SHA-256 IDs. Strip comments/variations before parsing without copying commentary. Read existing `/tmp/chess-morphy-history/morphy.zip` and `pmorphy.zip`; keep source archive fingerprints and reasons.
- [ ] Generate the index by legally replaying accepted games. For each Morphy turn increment that position's actual UCI move (`from/to` algebraic coordinates plus optional promotion). Assert every stored continuation remains legal and that START white choices come from his games, not Classic's book.
- [ ] Run focused corpus tests and a full import/replay. Commit validated facts, importer and provenance together; get task review.

### Task 2: Historical preference model and policy

**Files:** Create `src/engine/historical-features.ts`, `src/engine/historical-morphy.ts`, `src/engine/morphy-model.json`, `scripts/morphy-history/train.ts`, `tests/engine/historical-morphy.test.ts`. Modify only the dispatch entry in `src/engine/morphy.ts` and add the new config support in `src/engine/opponents.ts`.

**Interfaces:** `historicalFeatures(position: Position): number[]` returns fixed-order White-minus-Black normalized development, bishop mobility, rook files, central presence, king-ring pressure, castling, connected rooks, checks, premature queen exposure and knight activity. `historicalStyle(position: Position): number` returns bounded centipawns. `chooseHistoricalMove(position, level, seed, ply, now): AiResult` uses historical book then custom search with `evaluate(position)+historicalStyle(position)`. `historicalMorphyConfig(seed)` returns version 3 / historical-v1 / seeded-per-ply-v1 with validated seed. Legacy dispatch is unchanged.

- [ ] Test legality, deterministic seed, actual documented continuations, no Classic-book fallback, mate/terminal behavior, Black score perspective and bounded search. Example: a START reply supplied only as `d4` to the dispatcher must not make the historical book choose d4 unless d4 is in Morphy's own validated START record.
- [ ] Fit a fixed, reproducible regularized softmax preference model on normal games excluding the distinct serious-game holdout. Score each legal successor as `sign*evaluate(next)/100 + dot(weights, sign*features(next))`; use only training data for weight updates. Normalize features, constrain weights, cap net positional influence at 250 centipawns, retain full protocol and weights. No material discount.
- [ ] Evaluate held-out actual moves with the book disabled: top-choice accuracy and log loss against the style-v1 static preference baseline. Keep every eligible held-out position under the predeclared sampling rule (at most eight positions/game, ply >=8, >=2 legal moves, deterministic spacing). Do not tune using the final holdout; report limitations. If model fitting fails to improve held-out loss, investigate feature/quality modeling before selecting it.
- [ ] Runtime repertoire uses `posKey`, filters stored UCI against legal moves and weights exact historical counts using deterministic per-position seeded sampling. A supported new configuration never silently invokes style-v1 or Classic. Recognize game-end bounds before selecting a recorded move.
- [ ] Run legacy and historical engine tests, timed-budget checks, and independent review. Freeze model/data/policy for calibration.

### Task 3: Full-game strength measurement

**Files:** Extend `scripts/calibration/match.ts`, `run.ts`, `worker.ts` and tests without changing the existing default style-v1 protocol. Retain raw synthetic evidence under Downloads and accepted report under `docs/verification/morphy-history/`.

**Interfaces:** Add an explicit historical protocol selector; `MatchOptions` identifies opponent version 3 for new runs. Historical games use `opening: []`, while existing legacy runs retain sampled six-ply openings. Manifests include all new source/data/model files and production limits; workers verify every fingerprint and machine identity before play.

- [ ] Add failing tests proving the selector chooses historical-v1, starts from START, and old default runs remain unchanged. Verify illegal or unresolved results cannot qualify for rating and resume identity includes protocol/version.
- [ ] Run frozen seeded colour pairs for Casual, Club and Strong at 50 pairs each; extend only by the existing 100/200 checkpoints if required. Preserve all actual SAN games, elapsed times, result reason and machine conditions. No result editing or evaluation adjudication.
- [ ] Legally replay all accepted results, calculate existing pair-Wilson estimates, retain the audit and get independent calibration review. Only accepted finite estimates rounded to 25 enter the immutable version-3 rating table.

### Task 4: Versioned rating, selection and persistence safety

**Files:** `src/engine/opponents.ts`, `src/rating/opponents.ts`, `src/ui/Modals.tsx`, `src/ui/Home.tsx`, `src/storage/store.ts`, `src/storage/history.ts`, `src/account/records.ts`, `src/account/sync.ts`, `server/records.ts` and their existing tests.

**Interfaces:** `opponentPracticeRating` switches on exact supported version; old `MORPHY_RATINGS` remains version 2. Current setup selects historical version 3; rematch explicitly preserves 1, 2 or 3. New local keys state-v4/account-v4/history-v3 read prior generations only if absent, leaving original bytes. `X-Chess-Rating-Policy: 2` supports new records. The existing persistent policy table gains minimum capability with default 1; first version-3 acceptance permanently raises it to 2, including assisted games.

- [ ] Add failing exact-version receipt, hint/undo/forfeit/reload and rematch tests. Example: version-2 Club still resolves to 1375 after version 3 is selected. Reject old-client writes to a protected account even after Classic/reset; owners and pending versions remain isolated.
- [ ] Implement additive minimum-policy migration and atomic monotonic update. Accept policy 1 or 2 for legacy minimum 1; require exactly supported policy 2 for minimum 2. Never lower policy or delete its row during reset. Header checks and record update occur in one transaction.
- [ ] Migrate local saves/history/account pending overlays into the new authority once. Preserve corrupt current bytes, original prior keys and unknown-version recovery. Keep wire schema 2; reject incompatible legacy downgrade.
- [ ] Update Home and setup copy with actual measured version-3 numbers and accurate documented-game explanation; old rematches show old values. Keep biography sourced and avoid perfect-recreation claims.
- [ ] Run storage/account/server/UI regressions, full typecheck/lint/format, and code/security review.

### Task 5: Verification and delivery

**Files:** Existing browser journeys plus historical selection/repertoire coverage; README, CHANGELOG, AGENTS.md, VISION.md, package version and dated verification report.

- [ ] Run all unit/integration tests, both build flags, complete default browser suite and enabled historical/rating/history/account/offline journeys. Check Home in both themes and preserve the v2.2.1 Linux-font contrast correction.
- [ ] Run broad independent branch review and resolve findings. Record calibration uncertainty, historical holdout results, provenance/exclusions and remaining physical-device limits.
- [ ] Commit, fast-forward/push main, build an immutable target release with hosted personality enabled, back up private SQLite, switch only after target checks, and verify public bundle fingerprints plus isolated guest update/save/resume. Never use real player records for testing. Check GitHub verification and document the exact deployed source.

Execution uses separate task ownership and task reviews. No new user approval is needed for the already approved design or standing hosting scope.
