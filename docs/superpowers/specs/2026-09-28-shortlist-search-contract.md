# E2 inactive comparable-shortlist experiment

28 September 2026 BDT. Implements the approved E2 two-stage candidate-analysis experiment after
ordering and legal-move caching failed to demonstrate consistent elapsed benefit. Both rejected
experiments remain retained; this experiment branches from unchanged E1, combining neither.

Identity `next-neutral-shortlist-v1`; no existing opponent/worker import or rating change. Preserve
E1's exhaustive two-ply baseline, terminal precedence, exact position/history identity, branch
repetition restoration, cancellation and last-completed-iteration publication. Deep iterations still
visit every root; they may publish certified bounds for inferior moves, never mislabel them exact.

For each deep iteration, analyze the first preferred root with a full window to establish an exact
best score. For another move, use a one-sided child window ending at negative(best minus window).
If the returned root-side upper bound is STRICTLY below that threshold, retain it as a bound and
exclude the move from precise ranking. Otherwise re-search with a full window and retain its exact
score. A later improved best only tightens previous exclusions. Ties at the threshold are re-searched.

Expose an explicit integer `candidateWindowCp` setting0–300, default100 chosen before measurement.
This is a development search-budget setting, not an approved personality risk allowance. Freeze it
in result settings and every future candidate configuration. The published best move/score must be
exact. An iteration commits only after every root is either exactly scored or certified inferior.
Any interruption retains the previous entire baseline/deep snapshot, never a partial shortlist.

Scores remain White-relative. A root-side upper bound is an `upper-bound` for White to move and a
`lower-bound` for Black to move. Candidate consumers must discriminate these kinds; bounds cannot
be passed off as exact rankings or neutral-review annotations. Existing E1/result consumers remain
unchanged because this is a separate experimental module.

Fixed-work acceptance: compare every move against the E1 exhaustive-full-window reference at the
same fully completed forcing depth. Exact values must match; each bound must contain the reference
value in its stated direction and certify exclusion beyond the declared window; best scores must
match for both colors. Include threshold equality,0/100/300 windows, mate/forced defense, repetition,
interrupted baseline/refinement and forcing safety caps. Compare frozen development12 only; report
incomplete comparisons rather than treating them as equivalent. Retain every timed outcome and test
both run orders without optional extensions. No speed, strength or personality claim from bounds.
