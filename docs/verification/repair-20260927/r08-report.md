# R08 — interrupted computer clocks

27 September 2026 BDT. Local repair candidate; no release, deployment or live-player data.

## Implemented behavior

- Persist bounded, turn-specific interruption provenance (`ply`, `turn`, `at`, `cause`). Closing/loading, visibility transitions, an event-loop gap greater than one second, or the first worker failure can establish it. A legal computer move clears it; retry alone does not. Undo/new game discards the previous turn context.
- Settle real elapsed time before accepting a move. An interrupted computer timeout retains its result but cannot create a Practice Rating receipt. Human timeouts and uninterrupted computer timeouts retain existing calculations. Existing terminal receipts remain unchanged.
- Guest and account loading mark closed computer turns before their initial clock settlement. Shared validation, compact retention and persistent policy 6 are integrated by the coordinating agent. Previous recovery generations remain available.
- Ordinary replies retain the one-second presentation delay. Near timeout, cap the delay to leave 250ms; already-ready replies with less time apply immediately. A zero clock settles even if no additional millisecond elapsed. Search limits and playing policies are unchanged.
- Setup remains paused when multiplayer hides it. Unstarted computer games on Home do not start themselves. Existing timed Home work retains its original request and deadline.
- No pagehide write was added; exclusive ownership, temporary-play rules and stale-writer protection remain in place.

## Test-first evidence

1. Pure timeout/clearance and first worker failure: four expected failures (interrupted timeouts remained rated, legal move retained old provenance, failure callback absent), then ten passing checks.
2. Actual hook: seven expected failures (0/1/250/1000ms ready reply boundaries, first failure, event-loop suspension before reply, visibility suspension), then 34 passing hook checks.
3. Home/setup: an unstarted timed computer game started on Home; the regression failed before the pause correction and passed afterwards.
4. Additional coverage: manual retry retains cause through timeout; stale failure cannot tag a later turn; held ready reply expires safely after suspension; human timeout remains rated; first cause remains immutable; old completed receipt survives a late event.
5. Combined focused run: 19 files / 143 tests pass, including game, worker, Home/App/setup and shared storage interruption coverage. TypeScript checks and scoped ESLint pass.

An initial hook invocation used the shell's newer Node runtime, which exposes an incompatible native `localStorage`; all 34 hooks failed before setup. The supported `.nvmrc` runtime was then selected and the seven behavioral RED failures reproduced. A setup test initially omitted the `activateSound` mock export; corrected before the clean focused run. Neither tooling error is counted as behavioral RED evidence.

## Limits and pending integration

The visibility and one-second pause classification is intentionally conservative: a computer timeout during a UI stall becomes unrated even when a worker may have continued running. This matches the execution contract, without claiming precise operating-system suspension detection. Browser emulation and hook tests do not prove behavior on a physical mobile device. Independent scoped review and the candidate-wide browser/release matrix remain coordinator gates.

Full `npm test`: 90 files / 757 tests ran; 756 passed and one old-contract assertion failed in `tests/storage/store.test.ts` (“charges elapsed closed time and settles timeout once on load”). It expected a rated win after a closed computer turn, which this approved change intentionally removes. The fixture now separately exercises computer and human closed turns and repeated loading: the computer gets no receipt, while the human keeps exactly one. A fresh focused rerun, including this fixture, interruption state/hooks, setup and actual account-shell loading, passed all 74 tests in six files. The full suite was not rerun after this test-only correction. No other failure appeared. The latest full TypeScript check and scoped ESLint passed.
