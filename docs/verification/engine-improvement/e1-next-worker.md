# E1 inactive worker foundation — 28 September 2026 BDT

Separate `src/worker/next/` carries the reviewed shortlist-reuse search without changing production
AI/reviewer routes, current opponents, saved games or ratings. This is infrastructure, not a playable
new opponent. The current app does not import it. Its frozen contract is in
`docs/superpowers/specs/2026-09-28-next-worker-contract.md`.

Client clones requests, tags request/game/revision, terminates superseded work, suppresses late
workers, and gives crashes/invalid results/watchdogs one bounded retry. Incompletion returns explicitly
with no move and no automatic retry. No fallback to Classic or an old policy is possible. The future
app caller must retain the position and expose recovery; this foundation does not claim that UI.

Validation binds policy, position, prior-history fingerprint, White perspective, settings and outcome.
Completed candidates cover each legal root exactly once, carry valid exact/bound kinds, and select
an exact best. Baseline alternatives are exact. Bound directions/exclusions respect the side to move.
Terminal reasons/scores are independently checked against the requested root/history.

Independent TypeScript review found a native worker callback type mismatch, corrected before passing
canonical typecheck. It also reproduced contradictory iteration metadata: five new tests failed, then
passed after enforcing baseline2 followed by sequential forcing2..N, nondecreasing node counts,
attempted-depth/interruption consistency, and zero-work/no-interruption terminal results. Code review
approved lifecycle and score-bound mechanics; requested evidence gaps were covered subsequently.

Focused verification:24tests pass. Includes input cloning, stale reply, unknown policy/history/settings,
malformed move/score/kind, cancel/supersession/disposal, cancellation during retry, watchdog cleanup,
both-color checkmates/bounds, stalemate/dead position, duplicate/missing candidates, selected-bound
rejection, metadata corruption and direct worker policy dispatch. A Node worker-thread transport shim
bundles and executes the unmodified worker entry with real cloned messages and a200ms search.
This is not a real-browser, cold-start, PWA-offline or physical-phone test.

Budget starts inside the worker to match the retained search measurements. Startup and main-thread
validation are outside that search budget; watchdog adds1000ms. Actual-app integration must separately
measure startup, handle remaining game-clock time and test browser/offline recovery before activation.
History preparation in the experimental search is still bounded but not cooperatively cancellable;
worker termination provides cancellation here. Do not claim E1/E2 programme completion from this pass.

Full suite:106files/1030tests passed, plus typecheck/lint/format. Subsequent review found that sparse
iteration arrays could bypass Array.every's skipped slots. A new structured-clone corruption test
failed as expected; validating Array.from's explicit slots fixed it. Final focused25tests, typecheck
and lint pass. The full suite predates this one-line boundary hardening; no full rerun is claimed.
