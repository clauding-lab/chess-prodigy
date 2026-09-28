# E2 exact-probe reuse experiment

28 September 2026 BDT. Separate inactive identity `next-neutral-shortlist-reuse-v1`.
This hypothesis follows directly from the conservative shortlist algorithm, not a change to its
100-centipawn threshold or development positions. Keep the original shortlist source and all its
outcomes. Combine neither rejected move ordering nor rejected legal-move caching.

A completed child probe searches with alpha negative infinity and beta equal to the negated root
threshold. If its returned score is strictly below beta, it is exact: neither a fail-high bound nor
a fail-low bound. Equivalently the negated root score strictly exceeds the threshold. Reuse this
exact score without repeating the same subtree with a full window. Equality remains conservatively
re-searched. Root scores strictly below the threshold remain exclusion bounds, with Black's bound
direction reversed for White-perspective output. First root and shallow baseline remain full-window.

All completeness, history, repetition, forcing caps, cancellation, deadline, exact-best and settings
contracts from the conservative experiment remain. Any incomplete probe or equality re-search must
retain the entire last completed iteration. No ordinary opponent, worker, rating or save changes.

Before elapsed measurement, run the original shared safety suite and both-color threshold tests on
this variant. Compare all fixed development12 candidate values/bounds and best scores to unchanged
E1. Require full completion, legal unique candidate coverage, exact-best equality, valid bound
containment and exclusion. Compare visited-node totals separately; do not infer strength from them.
Then retain exactly four elapsed runs in reference→reuse→reuse→reference order with no mid-run tuning.
The fixed window remains100; no validation input is accessed. Actual-device, complete-game strength
and owner personality gates remain independent and unfulfilled by these experiments.
