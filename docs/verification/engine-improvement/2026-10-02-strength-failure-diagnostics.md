# Strength runner failure diagnostics — 2 October 2026 BDT

Local diagnostics revision only. No new experiment, failed-seed rerun, held-out validation, playing-policy change or release action.

## Change

The development runner now carries a typed worker failure through to the unresolved game record. Evidence version 1 retains the request (including opponent/seed, position and candidate history), failure stage, startup/calculation/total timing, fixed 15-second capacity, observed exit code and original response. Timing is null for calculation/startup completion when startup never completed; no invented measurements.

A readable JSON response projection accompanies an authoritative Node V8 binary serialization, stored as base64 text. The latter preserves values JSON cannot represent, including cycles, large integers, NaN, undefined fields and Maps. It is emitted only for received non-null responses. The runner does not deserialize this field to make playing or qualification decisions.

Baseline legality and exact move metadata are checked inside the evidence-preserving boundary. Incomplete candidate responses, invalid identities, missing/illegal moves, crashes, exits and capacity failures remain unresolved and stop execution. False responses are recorded as invalid replies rather than being misreported as timeouts.

`verifyStrengthGame` accepts original records without diagnostics and checks new evidence's stage, timing shape, game/turn/position, level and opponent identity. Candidate history and deadline must match the legally replayed game. A failure record never becomes a win, loss or draw. Manifest settings now explicitly include `failureEvidenceVersion: 1`; the current runner rejects original frozen settings rather than attaching new behavior to those manifests. Existing source fingerprints also prohibit mixing revisions.

## Verification

Real Node worker threads carry deterministic injected failures; these fixtures never invoke the failed Fischer position or regenerate its match. The incomplete-response fixture calls the real experimental decision function with zero remaining budget at START, making incompleteness deterministic without timing assumptions.

Observed failing tests before implementation: missing persisted evidence (four cases); non-JSON persistence and forged request rejection (two cases); silent JSON information loss; illegal baseline evidence loss; substituted opponent/history; false reply incorrectly reported as capacity timeout. Each was repaired and verified. The real 15-second capacity boundary is exercised without changing production limits.

Independent code and TypeScript reviewers approved the final revision after closing lossless-response, baseline-validation and request-binding findings. They did not run or inspect validation matches.

Integrity recheck: all 774 source fingerprints across six manifests and all 18 worker bundle hashes match the original archived source. The original failed Fischer record and start marker match the hashes in the failure disposition report. No `src/` files changed.

The first full-suite run overlapped subsequent regression additions and is not final evidence: two newly added diagnostics tests failed against the earlier implementation, and `tests/game/useGame.test.tsx` / “lets an explicit hint finish across Coach changes and background navigation” timed out at 5 seconds. No timeout was increased. Final verification uses two test workers to reduce contention; its results are recorded below when complete.

## Remaining work

The original development schedule remains blocked by its retained unresolved game. This repair cannot reconstruct its discarded response. A prospective diagnostic-development protocol and separate experiment decision must precede new runs. No change to Casual's budget, seed replacement, fallback policy or warmed worker lifecycle is authorized by this diagnostics revision. Tactical qualification, physical-device and blind-personality evidence remain outstanding.

## Final results

- Node v22.23.0: `npm test -- --maxWorkers=2` — 121 files / 1,093 tests passed. The previously timed-out hint-navigation test passed without modifying its timeout or application code.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `git diff --check` — passed.
- Disposable CLI integration probe: freeze a fixture directory, declare an injected crashing worker, run, and attempt resume. The unresolved record persisted structured startup evidence; resume refused; original game and start-marker bytes remained identical; no second game or summary was created. No actual playing engine was invoked by this probe.
- Independent code and TypeScript review: approved after fixes. No product build/browser rerun was needed for this script-only revision; no new browser/device claim.
- Logs retained in `2026-10-02-strength-failure-diagnostics-logs.tar.gz`, including expected failing tests, the superseded full-suite run and final successful checks.
