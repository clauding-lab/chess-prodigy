# Prospective tactical validation and one-shot qualification — 29 September 2026 BDT

This closes the methodological gaps identified in the strength-protocol review, subject to independent
cross-review before validation becomes executable. No validation positions or outcomes were inspected
while writing it. The reviewer inspected only the E0 manifest, which declares160validation samples.
Historical games informed retained repertoires; this partition is held out from new tuning, not wholly
unseen training data. Strength development remains separate and exploratory.

## One submission

Freeze Tal2 and Fischer2 together, their exact v1 baselines, all sources/books/settings/hardware,
schedules, evaluator and reporting code before exposing any validation result. This programme permits
one final submission per candidate, not repeated attempts with new seeds. After exposure, changed
candidates, failed/incomplete runs, harness defects and inconclusive evidence are not qualified.
Keep all evidence. A later programme requires a genuinely new holdout and prospective independent
review; changing the seed namespace is insufficient. Both candidates must pass their separate
strength/personality/safety gates before expanding this design to other masters.

## Tactical schedule and reference

Use the entire frozen E0 validation partition with its original seeds19471and78157. Legally replay
every history and verify its root. Report terminal positions separately under production rules and
freeze the resulting eligibility manifest before either candidate executes. All remaining positions
run against candidate and own v1 at Club and Strong, with no book or difficulty exclusions. The shared
denominator is every eligible position×seed. Alternate execution order by parity of sample index plus
seed index. Use real production worker paths and elapsed budgets, including documented book choices.
Failed/illegal/incomplete decisions have no substitution and make the gate inconclusive.
Each decision uses a fresh Node thread without warm-up, Club600ms/Strong2000ms, and the development
contract's15000msstartup-inclusive capacity cutoff. Record startup separately through worker-ready,
then message-inclusive calculation time. Do not retry a decision. This is not browser/phone evidence.

Reference is unchanged E1searchNext, full exact root candidates, forcing depths3and4 independently,
constant-zero clock,10000000nodes per invocation, capture/safety limits4/12. Require requested depth,
forcing phase and no interruption in both invocations. Freeze reference source and settings. A
reference failure makes the entire tactical gate inconclusive, never drops a position. Check feasibility
on development data only before final freezing. Reference is a shared custom evaluator, not independent
chess ground truth.

Convert reference scores to side-to-move perspective. A chosen move is a reference-defined tactical
failure only if both depths establish the same category:

- At least200centipawns below the reference best, with both scores outside the mate band.
- Selected move enters negative mate band while another move avoids that band.
- Reference best enters positive mate band while selected move does not.

Mate band is absolute score≥90000on the100000scale. Mate-distance differences alone do not count.
Record three boolean category flags independently at each depth; failure requires a nonempty
intersection of the two flag sets, counted once per decision. A selected negative-mate move while
best is positive-mate sets both mate flags, without double counting. Boundary fixtures must cover
199versus200cp,89999versus90000mate magnitude, opposite categories at the two depths(no failure),
and overlapping mate categories at both depths(one failure).
Retain each depth's exact scores, chosen move and category. Do not call these certified blunders.

An independent reviewer who did not tune the candidate receives anonymized A/B decisions, reference
evidence and legal histories. Audit all classified failures and all A/B disagreements; automatically
verify all other records. Check replay, exact completeness, perspective, thresholds and counting.
No intuitive overrides or evaluator tuning. Method defects block acceptance; subjective commentary
is kept separate from this mechanical classification.

## Tactical acceptance

Club requires strictly fewer candidate failures and an upper95%bootstrap endpoint strictly below0
for candidate failure rate minus baseline failure rate. Strong requires no more observed failures and
an upper endpoint≤0; equal zero failures is allowed for Strong. Neither gate substitutes for the
complete-game strength criterion. Zero eligible samples or insufficient reference evidence is not pass.

Resample whole source games carrying all their positions and seeds together; never independently
resample correlated positions. For each10000draws, recompute aggregate failure rates using that draw's
full sample count. Use xorshift32seed0x29c0ffee, shifts13/17/5, unsigned/2^32, floor to cluster index;
nearest-rank250/9750endpoints. Each candidate and level receives a separate interval. These intervals
are approximate and give no programme-wide guarantee. No pooling to rescue a failed candidate/level.
Report distinct source-game counts as well as position/decision counts. An all-zero failure sample
produces a degenerate interval, not proof of equal underlying risk.

## Complete-game validation schedule

Generate only after final submission freeze. Namespace is
`coherent-strength-v1:validation:<candidate>:<level>:<baseline>:<pair>` with the same FNV-1a rules as
development; baseline seed appends`:baseline:<baseline>`. Both color legs share their respective seeds.
For each candidate: Strong ownv1pairs0–199, StrongSpassky1pairs0–49, StrongChigorin1pairs0–49,
Clubownv1pairs0–99. No other qualification pools. Each matchup gets its own whole-pair estimate;
only own-v1Strong supplies the primary strength threshold. Production terminal/capacity/lifecycle rules
match the development execution contract. A missing/failed game blocks qualification without rerun.

Casual reports descriptive reliability and outcomes; this schedule establishes no cross-level ordering.
Blind owner12balancedpairs/9preference target and physical-device gates remain separate. No rating
can be assigned from these tests; fresh accepted calibration remains required afterward.
