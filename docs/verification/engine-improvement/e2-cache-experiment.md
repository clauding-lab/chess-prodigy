# E2 legal-move cache experiment — 28 September 2026 BDT

This inactive `next-neutral-legal-cache-v1` experiment branches from unchanged E1. It caches only
legal-move arrays for exact full FEN positions, in a request-local FIFO bounded to2048entries.
It never caches evaluations, terminal results, repetition outcomes or search bounds. No existing
opponent, worker, rating or saved identity uses it.

The instrumented E1 run completed36 decisions. Named CPU self samples were dominated by
`isAttacked`8333, `applyMove`2620, `posKey`2026 and `genPseudo`1046. The compressed raw profile and
summary are retained; anonymous/inlined frames prevent treating these as inclusive percentages.
Instrumentation timings are diagnostic only. This motivated testing repeated legal-move generation
before attempting history-sensitive score caching.

Independent code and TypeScript reviews found no correctness blocker: full FEN covers all position
fields; consumers copy/filter before changing arrays; draw/terminal evaluation stays outside the
cache. Review requested stronger eviction evidence. A new bounded test exceeds2048misses, confirms
2048retained entries and compares the exact retained result/node count after interruption. All15
original E1 safety/oracle tests now also run against the cached implementation, covering descendant
repetition, deadlines, forced defense, mates, forcing caps and both colors. Combined43 focused tests
passed, including five cache checks and eight profiler checks. Typecheck and source lint passed.

Fixed development12 comparison: every search completed forcing depth3 with identical candidate
scores, moves and node counts. Across those searches the cache recorded34410hits and334408misses;
maximum retained entries2048. The cohort/data/source hashes and each result are in
`e2-cache-fixed-v1.json`. No validation partition was read.

## Timing and decision

A balanced sequence was declared before running: reference→cached→cached→reference, with other
heavy agent work stopped. Every one of the144 decisions retained a completed result. First comparison:
1deeper/30same/5shallower; reverse comparison:0deeper/28same/8shallower. All four output files are
retained under `e2-cache-*-timed-*.json`; there is no favorable-run selection.

**Rejected for activation:** this bounded cache preserved correctness but did not improve elapsed
work on the development cohort. No capacity or key changes will be tuned on these same outcomes to
claim success. Retain the source/tests/results as a failed experiment. The next independently stated
hypothesis is E2's comparable-shortlist search against original E1, combining neither failed variant.
This result says nothing about human/FIDE strength or perceived historical style.

Final full verification:102files/948tests passed. Final TypeScript review confirmed eviction,
unchanged oracle checks and all six fixed-artifact source fingerprints. Rejection is solely the
observed lack of performance benefit; the experimental code is retained for reproducibility.
