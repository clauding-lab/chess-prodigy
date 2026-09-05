# Core correctness and TypeScript review

Reviewed 5 September 2026, approximately 19:52 BDT. Read-only review of `src/engine`, `src/book`, `src/coach`, `src/game/state.ts`, `src/game/types.ts`, `src/rating`, `src/worker`, `src/storage` and their tests. UI and the evolving `useGame` integration are excluded. This report reflects the files inspected at that time; later fixes need verification.

Context: read AGENTS.md, VISION.md and the production design. The parent supplied the user's later production-build authorisation. Git diff commands cannot provide a baseline because this directory is not a Git repository. Compared content-preservation tests and rating behaviour with the corrected reference. No implementation files changed during this review.

## Findings

### [HIGH] Accepted save data can crash coaching after restoration

File: `src/storage/schema.ts:132` and `src/storage/schema.ts:179`.

Issue: motif keys are accepted as arbitrary strings, and saved evaluation best moves are checked only for coordinate shape, not legality in their corresponding position. The validator then claims these values are safe `Session` data. `annotateAll` dereferences `MOTIFS[key].kind` and applies the best move without guards. This defeats the promised corrupt-save fallback.

Reproduced with Vite's module loader:

1. Create `freshSession(0, "x")`, make its first legal move at time 1.
2. Replace `hist[0].motifs` with `[{key:"invalid",detail:"bad",side:"w"}]`; set `evals[0]` to `{score:0,best:hist[0].mv}`.
3. `parseSavedState` accepts it. Dispatch the matching revision's evaluation for ply 1 with `{score:0,best:null}`. It throws `Cannot read properties of undefined (reading 'kind')`.
4. Independently, keep normal motifs but set `evals[0]` to `{score:1000,best:{from:20,to:28}}`. Parsing succeeds; evaluation of ply 1 with score 0 throws `Move has no moving piece`.

Fix: validate motif keys against the catalogue; bound evaluation ply to the replayed history; verify every non-null best move against the legal moves at that ply, including move metadata, or reconstruct canonical legal moves before use. Apply recognised annotation values as well.

### [MEDIUM] Clock fields are not checked against the saved time control

File: `src/storage/schema.ts:162` (and `:129`).

Issue: both clockless and timed games accept either null clocks or arbitrary finite nonnegative clock pairs. History clock snapshots have the same gap. A timed save with null clocks restores as a game whose timer never runs; undo can also convert a timed game into a clockless game through a corrupt history snapshot. Finite numbers such as `1e100` remain accepted, despite the bounded-number contract.

Reproduction: create a legal one-move clockless session, change only `game.setup.time` to `"5+0"`, and parse it. It is accepted with `clocks:null`; subsequent ticks never expire the game.

Fix: require clock/null consistency for the selected control in current and historical state; impose control- and move-count-aware bounds on remaining time, plus a valid finite timestamp range. Add reload and undo corruption cases.

### [MEDIUM] Rating receipt does not prove consistency of the rollback state

File: `src/storage/schema.ts:210`.

Issue: receipt checking compares rating, delta and game counts, but does not verify that applying the recorded result to the receipt's complete `before` value reproduces the saved rating. The prior peak, reached-2400 flag and history can diverge. Undo trusts and restores that whole prior object, allowing an accepted inconsistent save to change the future K-factor policy (the rating adjustment multiplier).

Reproduction: create a session, make one move, resign, then modify only `game.ratingApplied.before.peak=9000` and `.reached2400=true`. `parseSavedState` accepts it although the current rating still has peak 1400 and reached2400 false. Undo restores peak 9000 and permanently switches the multiplier to 10.

Fix: validate a settlement as a complete transition using the saved result, opponent level, previous rating and last entry date; compare full next rating/history/peak/flag and applied delta. Verify rollback history belongs to that same transition.

### [MEDIUM] Root search continues from a position already drawn by the fifty-move rule

File: `src/engine/search.ts:155`.

Issue: child search and quiescence handle the halfmove threshold, but the top-level search handles only positions with no legal moves. It can select a capture that resets the counter, giving a winning evaluation after the game's automatic draw already occurred. This is relevant to post-game analysis even though the game reducer correctly ends play.

Reproduction: `search(fromFEN("7k/p7/8/8/8/8/8/QK6 w - - 100 80"),2,100)` returned `{move:{from:56,to:8,capture:"bp"},score:890,depth:2}`. Expected a terminal draw result with score 0 and no move under the app's approved automatic policy.

Fix: apply terminal draw checks at the root, retaining checkmate/stalemate precedence. Test the fifty-move threshold with a legal available capture and root insufficient-material positions.

## Verification and coverage

`npx vitest run tests/engine tests/coach tests/game/state.test.ts tests/storage tests/worker` passed: 9 files, 118 tests. This invocation also selected the 17 existing JavaScript engine regressions. Tests preserve all 185 opening lines verbatim and legally replay them, preserve the 27 motif cards verbatim, exercise the supplied motif fixtures, clock settlement, rating floor, receipt idempotence, worker cancellation/retry/watchdog and the covered corruption cases.

The four findings above were demonstrated by executing the actual modules, not inferred solely from absent tests. Existing tests do not cover these reproductions. No separate finding is raised merely for code formatting or function length. Full-project strict typechecking and browser/device acceptance are outside this scoped review and should be taken from the parent verification run.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 1 | warn |
| MEDIUM | 3 | info |
| LOW | 0 | pass |

Verdict: WARNING — resolve the HIGH restoration crash before release; the three MEDIUM issues conflict with explicit persistence/search contracts.

## Resolution review — 5 September 2026, 19:57 BDT

Re-reviewed only the four findings above and their fixes. All four are resolved:

- Coaching saves now require recognised motif and annotation values. Evaluation positions must exist in replayed history, and best moves must match a legal move including its capture/castling/en-passant/promotion metadata. The two crash-producing inputs are rejected as corrupt.
- Current and historical clocks must agree with the selected time control. Bounds account for each colour's completed moves and increment; clock timestamps must be nonnegative safe integers. Null and oversized timed-clock inputs are rejected.
- Receipt validation recomputes the full rating transition from its prior state and the recorded game outcome, then compares the complete resulting rating, including history, peak and reached-2400 flag. The corrupted rollback state is rejected.
- Root search returns `{move:null,score:0,depth:0}` for the fifty-move draw and insufficient material, after handling checkmate/stalemate so terminal precedence is preserved.

Fresh verification: `npx vitest run tests/storage/store.test.ts tests/engine/search.test.ts` passed **20 tests in 2 files** (14 storage, 6 search). The new tests reproduce all four reported defects and verify rejection/terminal handling; existing positive storage roundtrips and timeout settlement still pass. No implementation changes were made during this re-review.

### Updated Review Summary

| Severity | Unresolved count | Status |
|----------|------------------|--------|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 0 | pass |
| LOW | 0 | pass |

Verdict: APPROVE for the four reviewed fixes. This is a scoped resolution, not a fresh full-project or physical-device review.
