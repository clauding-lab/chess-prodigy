# Engine improvement design — proposed

**Date:** 27 September 2026 BDT
**Status:** Draft for owner review. This proposes new policies; no experiment, implementation, new rating or deployment has been approved by this document.
**Purpose:** Make Chess Prodigy's opponents reliably playable, recognizably different across a game and capable of better tactical calculation, without rewriting earlier games or claiming to reproduce historical minds.
**Owner priority confirmed 27 September:** Stronger play and distinct personalities equally. Neither is optional and neither compensates for failure of the other.
**Master plan:** [Repairs and engine programme](../plans/2026-09-27-repair-and-engine-master-plan.md).

## What is known and what is not

The retained Club probe reports 68–82% agreement with Classic after recorded openings, 17–30% of decisions changed by personality, and roughly 1.8–3.2 own recorded moves before leaving the historical repertoire. Those are measurements of the sampled positions and simulated opponents, not universal human-game rates. The 0.66 pairwise headline includes old versions; recompute a six-current-opponent baseline before setting a target.

The production roster code performs a shared neutral search, excludes alternatives outside a loss window, then scores the remaining moves with personality bonuses. Several bonuses overlap. There is seeded tie-breaking, so “no randomness anywhere” is too absolute; the measured behavior is overwhelmingly deterministic after the book. Tal already has a sacrifice mechanism, but it rarely affects sampled play.

No blind owner baseline exists. Full-game Casual/Strong behavior and actual-phone timing are incomplete. Better depth may enable sound attacking choices; it is not established that a stronger core can never help personality. Agreement on a forced recapture or only safe move is good behavior.

## Alternatives

| Approach | Benefit | Limitation | Decision |
|---|---|---|---|
| Labels and opening reweighting | Small interface changes and some variety | Does not address most middlegame choices; changing frequencies changes policy | Add honest explanations later; preserve frequencies initially |
| Better search plus distinctive multi-move plans | Addresses unsafe fallback and overlapping choices; reusable for all five masters | Requires experiments, versioning and calibration | Recommended |
| Separate engine per player or external replacement | Potentially large architectural divergence | High maintenance/calibration cost; Stockfish/replacement conflicts with current scope | Excluded |

## E0 — Establish the benchmark before tuning

**Files:** promote reviewed harnesses into `scripts/engine-bench/`; add `tests/engine/personality/`; retain results under `docs/verification/engine-improvement/`. Reuse the existing agreement/game harness inputs without treating them as independent held-out evidence.

Split positions by whole source game into development and untouched validation sets. Include opening deviations, quiet positions with several credible plans, tactical necessities, sacrifices with compensation, traps without compensation, winning conversion, defensive positions and endgames. Deduplicate transpositions across splits. Compare all six current choices and evaluate legacy Morphy separately.

Use two measurement modes: fixed completed work to compare decisions reproducibly, and production elapsed-time limits to measure actual user behavior. Report achieved depth, visited positions, elapsed time, worker startup, timeout rate, incomplete comparisons and selected plan. Test all three levels, both colors and independent seed sets. A “ply” is one player's move; never confuse it with a full move in reports.

Keep strength, tactical reliability, variety and personality as four separate scorecards. Record pairwise move agreement on the full set and on genuine-choice positions; do not lower agreement by injecting bad moves. Record repeated games and plan sequences as well as single moves.

Proposed human comparison: 12 balanced anonymous baseline/candidate pairs for Tal versus Fischer in the actual app, same starting positions/colors and hidden version labels. Record preference, perceived plan coherence and mistaken identity. Treat it as directional owner evidence, not a statistical proof of historical authenticity. Extend to the other masters only after the first pair improves.

## E1 — Safe behavior when time is short

**Files:** `src/engine/search.ts`, new version-specific search/policy modules, `src/engine/{opponents,morphy,chigorin}.ts`, `src/engine/roster/*`, `src/worker/*`; deadline and tactical tests.

Preserve the last fully completed search iteration. Expose whether a candidate score is exact, a bound or incomplete; never compare these as if they were equally reliable. Retaining one evaluated candidate is not proof that unsearched moves are worse.

Before deeper work, establish a bounded shallow legal baseline that checks immediate tactical danger, then refine. Prefer an already-completed iteration when the next is interrupted. If a request arrives with no time to perform even this baseline, return an explicit incomplete/failure result for clock recovery, rather than labeling the first ordered capture as evaluated. No finite-time search guarantees a blunder-free move.

Test pre-expired deadlines, expiry after the first candidate, during a forcing line, and just before completion. Include F01's queen capture and losing/forced positions where every move is bad. Keep mate/terminal handling before repertoire lookup.

All resulting playing changes use new configurations. Preserve legacy paths even when the old behavior is undesirable; new games select corrected measured versions after release. Do not silently substitute them into old rematches.

## E2 — Improve calculation per millisecond

Profile before changing algorithms. The immediate suspect is the current all-candidate search, which clears its position cache between root alternatives and searches each with a full window. This is a correctness-preserving starting point but can be expensive.

Experiment in this order, one change at a time:

1. Better move ordering: try promising prior results and sound captures earlier; measure whether it completes more work within the same budget.
2. Safe cache reuse: store depth, bound type, perspective and policy identity; include draw/history context where relevant. Do not reuse style-tainted or incompatible scores across personalities.
3. Two-stage candidate analysis: find a strong neutral line efficiently, shortlist plausible alternatives, and obtain comparable exact scores for those needed by personality selection. Bounds may reject safely but cannot masquerade as exact ranking values.
4. Bounded forcing-line analysis: extend checks/captures when needed to judge tactical consequences without unbounded checking loops. Retain hard deadlines and cancellation.
5. Evaluation improvements only where failing examples justify them: hanging material, king safety, mobility and winning conversion. Do not add a large set of weights without isolation tests.

“Search” means looking ahead through possible moves; a cache remembers previously analyzed positions. These changes aim to do more useful calculation within Casual 200 ms, Club 600 ms and Strong 2000 ms before considering any time-budget increase. Time limits include a declared personality ranking allowance; do not hide extra computation outside measurement.

Acceptance uses legal-move/perft regressions, fixed-work differential comparisons, tactical outcomes and actual-device completed work. A speed optimization can still change timed move choice and therefore needs new measured policies. Stronger is measured by results, not depth labels alone.

### Strength acceptance alongside personality

Before tuning, register a development match protocol against frozen old versions and a separate untouched validation match set. Use color-swapped complete games, declared seeds, identical hardware/time limits and no opponent tuning against validation results. Keep exploratory strength tests separate from the final Practice Rating calibration.

Proposed validation protocol: freeze 200 color-swapped pairs (400 complete games) per candidate at Strong against its corresponding old version, with production limits and no optional extension after seeing the result. Compute the mean of each pair's two scores and a 95% paired-bootstrap interval from 10,000 resamples using a retained deterministic seed. Require a score above 50% with the lower bound above 50%; inconclusive evidence means “not demonstrated”, not a pass. Independently review the interval method before freezing the protocol. Run an additional fixed 50 pairs against each of two other frozen opponents selected before tuning, to expose overspecialization.

For Club, run a fixed 100 pairs against its old version; require observed score at least 50%, the lower interval bound at least 45%, and fewer verified tactical failures. Seek a positive strength gain there too. These numbers are proposed acceptance rules for owner review, not claims of achievable improvement. Retain all results; a revised candidate gets a new experiment identity and a fresh validation set rather than repeated attempts on the same held-out set.

Casual remains an approachable difficulty. Improve reliable decisions and eliminate accidental hardware-dependent blunders rather than demanding every Casual player become much harder. Maintain ordered Casual/Club/Strong measured strength; if all three tiers are to become substantially harder, obtain that product decision before setting final targets. No deterministic fake-clock result substitutes for real-time match results.

At the Tal/Fischer experiment gate, both the registered strength test and the personality comparison must pass before expanding the architecture. If style reduces strength, improve calculation or redesign the plan; do not conceal the tradeoff through a new rating label. Final calibration assigns honest ratings only after these development gates pass.

For context only, modern search implementations combine iterative deepening and move ordering; the [official Stockfish search source](https://github.com/official-stockfish/Stockfish/blob/master/src/search.cpp) is a primary reference. This design proposes neither importing its implementation nor adding Stockfish to the application.

## E3/E4 — Different priorities that persist across moves

Begin with Tal and Fischer as contrasting candidates, then extend the successful design to all existing historical choices. All descriptions below are designed playing priorities, not learned historical thoughts.

| Opponent | Signature priority | Observable behavior | Negative guard |
|---|---|---|---|
| Morphy | Rapid development into open lines | Bring inactive pieces into play, open the center when ahead in development, coordinate before attacking | Do not launch an unsupported attack merely because development is rewarded |
| Chigorin | Active knights and central counterplay | Seek durable knight outposts, support central pawn breaks and coordinate pieces around them | Do not prefer a knight maneuver that loses material or abandons king safety |
| Spassky | Flexible improvement before a justified transition | Improve the least effective piece, then switch to central or wing play when concrete conditions change | Do not repeat development/castling bonuses as the whole personality |
| Tal | Initiative and forcing complications | Prefer sustained threats, king exposure and sacrifices with independently checked compensation | Reject empty piece offers, unsound checking sequences and attacks the opponent can simply refute |
| Fischer | Durable pressure and clean conversion | Build activity on open files, restrict counterplay and trade into favorable endings | Do not trade automatically while behind or erase a stronger attack just to simplify |
| Classic | Neutral benchmark | Best neutral play under its versioned difficulty contract | Keep the existing rated Classic frozen as a measurement anchor |

Each plan has entry conditions, target features, termination/abandonment conditions and a bounded influence on move choice. Derive plan state reproducibly from position, legally replayed history and seed initially; introduce persisted plan state only if needed, with explicit versioning and replay tests.

Keep safety and style separate. A neutral calculation estimates tactical cost; personality ranks credible choices. Improve compensation analysis before widening Tal's safety window. A centipawn is one hundredth of a pawn in the engine's estimate; a low shallow loss estimate is not proof of safety.

Use seeded variety among genuinely close, plan-compatible alternatives. It must replay identically from the same configuration/history/seed and must not increase mate allowance or material blunders. Variety should express the same personality through several acceptable plans.

Proposed acceptance gates to finalize before tuning:

- Every frozen critical tactical/timeout fixture passes; exact forced moves are not penalized for agreement.
- On held-out genuine-choice positions, mean pairwise agreement improves by at least 10 percentage points relative to the corresponding baseline, with uncertainty reported. No target is selected after inspecting candidate results.
- Plan-specific positive and negative sequences pass for both colors and persist beyond a single bonus-winning move.
- Changed-move loss does not worsen materially relative to baseline under a deeper independent neutral review; inspect the worst cases and upper tail, not only the mean. Final loss thresholds are chosen from E0 before candidate tuning.
- Anonymous owner comparisons prefer candidate distinctness/coherence in at least 9 of 12 Tal/Fischer pairs; document small-sample limitations and all rejected pairs.
- Report strength separately. A weaker but more distinct experimental engine is not presented as an overall improvement without an explicit tradeoff decision.

If the gates fail, stop and record why. Do not repeat prior failed weight-only or historical-fit experiments under a new name. A new idea requires a new stated hypothesis.

## E5 — Better openings and honest explanations

Preserve exact documented-game occurrence weights for the first experiment. Assess common user deviations such as 1.c4/1.Nf3 and early quiet moves; book depth alone is not the success measure.

If early exits still dominate experience, add a separately labeled designed-continuation layer based on the selected personality's plan, with sourced/licensed opening material where used. Position matching must include side, castling and legal en-passant context. Do not label a designed move as a documented master's move or silently fall back to Classic's book.

Display compact factual rationale: “Recorded in Morphy games” with a validated count, or “Designed plan: develop and open the center.” A rationale must describe actual decision metadata, never fabricated thought. Neutral coaching can still criticize a documented move.

Changing book selection or introducing continuations changes playing policy and requires the same freeze/measurement discipline as search changes.

## E6 — Compatibility, measurement and release

Register new opponent configurations with explicit engine, policy, repertoire and seed semantics. Never reuse an existing version identity for changed behavior. Snapshot source and repertoire hashes before measurement; any subsequent playing change invalidates that candidate's run.

Retain every existing fixed receipt and rematch policy. If saves gain new identities/fields, advance local authority generations and permanent minimum client policy with additive migrations; choose the next numbers from the actual head at implementation time. Wire schema 2 remains only if the new contract can be represented and protected without breaking acknowledgements; otherwise design an explicit wire upgrade before coding.

Measure each changed level from START using production limits, paired colors and frozen seeds. Apply the accepted per-level 50/100/200-pair checkpoints and first-eligible rule unless a new protocol was approved before any runs. This means 100, 200 or 400 complete games per level, not an automatic 400-game total per opponent. No unresolved games; audit legal histories, endings, pairing and source fingerprints independently.

Keep old Classic frozen for longitudinal comparison. If offering stronger Classic, register a new Classic version and benchmark against the old anchor; do not silently move the rating ruler. Existing ratings remain valid for their existing configurations, even when new configurations need fresh values.

First integrate candidates locally behind a default-off flag and keep them unrated. Rated normal setup follows independent measurement acceptance, actual-app/offline/account checks, reviewed migration and a separately authorized release. Old rematches explain their preserved version.

## Success criteria

The owner can recognize meaningful differences in anonymous actual-app play; independently tested tactics and timeout handling improve; phone behavior is measured; and all old games, ratings and recovery protections still work. Strength, historical fidelity and perceived personality remain separately reported claims.
