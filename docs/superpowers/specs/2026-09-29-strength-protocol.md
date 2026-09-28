# Prospective Tal/Fischer strength protocol v1 — 29 September 2026 BDT

Registered before implementing/tuning coherent-v1 plan preferences. Search-only development profiles
remain exploratory evidence, never complete-game strength or validation evidence. This protocol does
not assign Practice Ratings; final calibration remains a separate accepted process.

For each Tal2/Fischer2 candidate, development uses20fixed color-swapped pairs per level versus its
corresponding frozen version1. Development seeds are deterministic FNV32 of
`coherent-strength-v1:development:<id>:<level>:<pair>` for pair0..19. Validation is inaccessible to
candidate tuning and uses a distinct `validation` namespace. Freeze candidate and baseline source/book
hashes, hardware/Node, exact settings and full schedule before execution. A changed candidate receives
a new experiment identity and untouched validation seed namespace; preserve rejected runs.

Strong validation:200pairs versus ownversion1, plus50pairs each versus Spassky1 and Chigorin1, selected
now before personality tuning. Club:100pairs versus ownversion1. Casual reports reliability and ordered
strength; no new requirement to make approachable Casual much harder. Colors swap within each pair;
use the same per-pair seed for both legs and deterministic opponent seeds in a separate namespace.
Every game starts from START, uses legal recorded full histories, production elapsed200/600/2000ms
including personality work, and runs sequentially with other benchmark/test work stopped. Record
startup separately and disclose warm state. Reject source/settings drift and never overwrite games.

No optional extension or selective omission. A crash, illegal/stale move, unresolved game or capacity
limit blocks qualification; retain the failure instead of calling it a draw or replacing its seed.
Only genuine legal terminal results count. All games and pairs must be present exactly once.

For each complete pair compute the mean of its two candidate scores (win1/draw0.5/loss0). Report overall
mean and percentile95% paired-bootstrap interval from10000resamples of whole pairs, using deterministic
xorshift32 seed0x29c0ffee and nearest-rank order statistics (ranks250/9750, one-based). Resample pairs,
not individual games. Independent method review precedes any validation run.

Strong acceptance:mean>0.5 and lower95%bound>0.5 versus ownold; cross-opponent results reported in full.
Club:mean>=0.5,lower>=0.45,and fewer independently verified tactical failures. Inconclusive is not pass.
Strength acceptance cannot substitute for safety/personality acceptance; both are required before
expansion to other masters. Blind owner comparison remains12balancedpairs with9/12preference target.
No validation game has been run or inspected when this protocol was written.

## Independent review amendment — 29 September 2026 BDT, before any matches

The independent review accepted whole-pair resampling and the stated percentile ranks, but did not
accept the qualification contract yet. The interval is an approximate uncertainty estimate, not a
guarantee of 95% coverage. Development is exploratory only. The executable runner deliberately cannot
generate validation games or declare qualification. No candidate tuning or games followed this review
before recording these amendments. The original registration preceded plan implementation; this later
execution detail is explicitly an amendment rather than a claim of earlier preregistration.

Development execution is now fixed:

- FNV-1a starts at2166136261, XORs each ASCII label character, multiplies by16777619 with unsigned
  32bit overflow. Candidate labels are the originally declared strings. Baseline labels append
  `:baseline:<id>`. Both color legs share their respective candidate and baseline seed. Each selected
  candidate/level gets exactly pairs0–19, ordered White then Black. No replacement seeds.
- Use the unchanged production browser worker entries bundled for a fresh Node thread on every ply,
  with no warm-up or process reuse across plies. This is Node development evidence, not a browser or
  phone performance claim. Startup ends when the thread installs its message handler; calculation time
  includes message transit. Both are retained separately. Book and plan decisions are retained.
- Freeze complete source/book and worker-bundle hashes, machine/Node, schedule and integrated settings
  before execution:200/600/2000ms; depth8; forcing capture4/total12; shortlist100cp;
  Tal100/Fischer50cp safety windows; ranking reserve30ms. Existing v1 policies remain exact.
- Production terminal precedence is no legal moves(checkmate/stalemate),100halfmove draw,
  third legal repetition, then the experimental engine's bishop-only dead-position rule(v2).
  This rule now also governs the new experimental app identities; older games keep their original
  insufficient-material rule and baseline move policy stays unchanged. Full prior-position history is
  passed to the candidate. No adjudication, resignation, time forfeits or opening prefix.
- Capacity is1000plies or15000ms for one worker(startup included). Missing/illegal/stale/incomplete
  replies, crash, unexpected terminal disagreement or capacity stop are retained unresolved failures.
  Stop the entire schedule at the first failure; never replace it with a draw or rerun its seed.
  A start marker without a complete record blocks resumption. Source/machine drift also blocks it.
- Bootstrap uses xorshift32 shifts13left,17unsignedright,5left; unsigned output divided by2^32;
  sampled index is floor(output times pair count). Seed and percentile ranks remain as above.
  Each matchup has its own estimate. No pooling across levels or opponents. Development never passes
  a qualification gate, even if its estimated interval clears a validation threshold.
- Remove the unsupported Casual ordered-strength conclusion from this programme's evidence claims:
  Casual development reports outcomes and reliability only. Direct cross-level testing would need
  its own preregistration before claiming the levels are ordered.

Validation remains blocked until a follow-up independent review accepts a fully specified tactical
failure definition, fixed evaluator/budget/threshold/denominator and comparison schedule, independent
adjudication, and repeated-attempt control. The own-v1 Strong comparison alone supplies its main
criterion; other opponents are separate reports. No validation seeds or games are generated meanwhile.
Changing seed namespaces after a failed validation alone is explicitly insufficient repeated-attempt
control. These remaining requirements cannot be chosen after inspecting validation outcomes.

Follow-up: `2026-09-29-tactical-validation.md` now defines those requirements. Independent method
cross-review closed the worker-lifecycle and overlapping-category ambiguities. Pure classification
and cluster-bootstrap helpers are tested and reviewed without data access. Validation execution is
still unavailable: reference feasibility must first be checked on development data, and the future
assembler/runner must prove complete frozen schedule coverage before a final submission can run.
