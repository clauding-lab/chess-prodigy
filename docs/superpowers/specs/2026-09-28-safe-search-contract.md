# E1 — inactive, versioned safe-search reference

28 September 2026 BDT. Implements the approved engine design; stronger play remains unproven.

Implement `src/engine/next/search.ts` with policy `next-neutral-v1`. Only tests/development tools
may import it during E1. Existing search, reviewer, opponent identities, books, ratings and runtime
dispatch remain unchanged. Future Tal/Fischer candidates receive new identities before app entry.

Inputs are a legal position, prior FEN positions **excluding the current root**, maximum depth,
elapsed-time budget, optional absolute deadline, clock/cancellation hooks and a fixed node budget
for deterministic testing. Parse/bound history once; maintain repetition counts down each branch
and restore them on every exit. The public result identifies exact root FEN, history fingerprint,
policy, White-relative score, nodes, elapsed time, attempted and completed depth.

First complete an exhaustive, deterministic two-ply baseline: each legal root move and every
immediate opponent reply. Check terminal conditions at children/leaves, including immediate mate,
before static evaluation. Commit nothing until all alternatives and the final deadline check pass.
An interrupted baseline returns `incomplete`, null move/score and no selectable alternatives.
It never reports the first ordered capture as a calculated answer.

Then attempt depth-two and deeper full-window comparisons with bounded forcing search. Keep the
previous snapshot immutable until every root completes at the same depth and leaf policy. Results
distinguish `baseline` static leaves from `forcing` refinement. “Exact” means exact for this bounded
policy/horizon, not a proven chess truth. Internal cutoffs carry lower/upper bound semantics; only
full-window exact root comparisons are published. No score cache in E1; E2 will add optimizations
against this correctness reference. Move ordering is deterministic.

Stand-pat evaluation is prohibited in check. Required check evasions reaching the forcing safety
cap abandon that iteration as incomplete; they do not become exact leaf scores. Check deadlines
and cancellation around expensive work and before publication. Preserve the last fully completed
baseline/iteration when subsequent work stops. Losing positions may still produce completed moves.

Mate/stalemate precedence comes before fifty-move, repetition and approved version-two dead-position
classification. Existing computer rules remain frozen. E1 does not search a repertoire; future
callers must settle terminal state before documented opening selection.

Tests cover both colors, poisoned queen captures, immediate mating replies, forced evasions,
unavoidable loss, pre-expired and mid-iteration budgets, final-publication interruption, repetition
identity, terminal precedence, exact finite common-depth candidates and restoration after abort.
Architecture review approved this minimal reference and separate E2 ordering/cache/selection stages.
No playing-strength, historical fidelity or perceived personality claim follows from E1 tests.

The forcing policy permits four capture/promotion plies and at most twelve forcing plies in total.
The explicit `forcingSafetyPlies` setting accepts 0–12 for bounded experiments; future candidates
must freeze it (default 12), maximum depth and baseline-only mode as part of their configuration.
Every result includes these settings. Injected clocks must return finite values. History preparation
is bounded to 12,800 positions but currently precedes cancellation checks; measure this cost before
production integration. No cache may later identify compatibility using the policy label alone.
