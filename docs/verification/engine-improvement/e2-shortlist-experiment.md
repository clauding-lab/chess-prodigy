# E2 shortlist experiments — 28 September 2026 BDT

Both modules are inactive development experiments based on unchanged E1. No current opponent,
book, worker, rating, saved game or rematch is changed. Exact means exact for this bounded search
policy, not perfect chess. Neither experiment incorporates rejected ordering or legal-move caching.

## Conservative shortlist

`next-neutral-shortlist-v1` establishes a full-window first root, probes remaining roots against
best minus100centipawns, excludes certified inferior bounds, and re-searches every other root with
a full window. It retains the complete two-ply baseline and entire last completed deeper iteration.
White-relative bounds discriminate upper/lower kinds; selected best is always exact. Window0/100/300,
both colors, actual multiple mate ties, repetition, forcing caps, deadlines and interruptions are
covered. The shared original safety suite was extended without weakening reference exact assertions.
Independent review checked all329 fixed candidate records and all source fingerprints.

Frozen development12 fixed-depth3 comparison:12 completed comparisons, no mismatch. Reference
368806nodes versus candidate408451nodes (10.7% more). All candidate exact values and best scores
match; every bound contains its reference value and excludes the move beyond the final threshold.
The conservative re-search repeats useful work in some positions.

All144 decisions in the predeclared reference→candidate→candidate→reference elapsed sequence
completed. First comparison:6deeper/27same/3shallower. Reverse:7deeper/24same/5shallower. This mixed
result does not establish a consistent improvement; do not promote this version. Full outputs remain
in `e2-shortlist-*-timed-*.json`; the exact profiler used is retained in
`e2-shortlist-timed-v1-harness.ts.txt` with matching SHA256
`0aade0c7429bf9c7013e6bc5f7f96ad04044d33cbdc6429fa11fbdd56848f0a4`.

## Exact-probe reuse

The separate reviewed contract identifies a redundant calculation: child search with alpha negative
infinity and finite beta returns an exact result when strictly below beta. Its negated root score
strictly exceeds the threshold and can be reused. Equality remains conservatively re-searched.
`next-neutral-shortlist-reuse-v1` changes only this case and its explicit policy identity; original
conservative implementation and outcomes remain. Review confirmed path repetition restoration and
that forcing/deadline/node interruptions throw instead of posing as numeric bounds. Different pruning
can avoid a forcing-limit branch; only mutually completed searches qualify for exact comparison.

Missing-module RED preceded implementation. All86 shared/search safety tests pass for four variants,
including26 shortlist-specific cases. Profiler route RED1→GREEN10 confirms explicit variant selection.
Fixed development12:12completed, no mismatch,368806reference nodes versus223848reuse nodes (39.3%
fewer). Node reduction is not elapsed benefit, playing strength or perceived personality evidence.
Independent code and TypeScript review approved mechanics. Balanced elapsed evidence follows.

All timings are Node development measurements at200/600/2000ms, fixed Casual→Club→Strong order and
no separate warm-up. No validation partition, worker startup, personality ranking or physical phone
is included. Ordinary desktop background tasks remain uncontrolled. Strength, tactical held-out,
actual-app, physical-device and blind owner gates remain separate.

Reuse elapsed results: all144decisions completed. First10deeper/24same/2shallower; reverse
9deeper/24same/3shallower. Strong was4deeper/8same/0shallower in each order. Club was4/8/0 then3/7/2;
Casual2/8/2 then2/9/1. Retain allfour `e2-shortlist-reuse-*-timed-*.json` outputs. This is promising
aggregate development evidence, with explicit per-position regressions; it does not satisfy E2's
actual-device, tactical held-out or complete-game strength gates. No normal-play activation.

Full final checks:103files/1006tests passed; typecheck, lint and format passed. Code/TypeScript reviews
approved the separate reuse proof, implementation and harness route. Existing engines remain frozen.
The next integration must preserve explicit incomplete recovery and carry exact policy, settings,
position/history and request identity through a separate development worker boundary; do not route
these results through the unchanged broad production AI result union.
