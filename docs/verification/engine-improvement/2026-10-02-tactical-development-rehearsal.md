# Tactical development rehearsal — 2 October 2026 BDT

All192 scheduled decisions completed with valid legal moves, and all24 previously frozen reference records verified. The full denominator was preserved. This is a successful development collection/classification rehearsal, not a held-out tactical gate, strength result or reliability certification.

| Comparison | Decisions per side | Experimental failures | Frozen v1 failures |
| --- | ---: | ---: | ---: |
| Tal Club | 24 | 0 | 2 |
| Tal Strong | 24 | 0 | 0 |
| Fischer Club | 24 | 0 | 0 |
| Fischer Strong | 24 | 0 | 0 |

“Failure” here means the already-registered shared reference category at both independent depths3and4: at least200centipawns of non-mate loss, an avoidable negative mate-band result, or a missed positive mate-band result. A centipawn is one hundredth of the engine's nominal pawn value. These are custom-reference judgments, not certified chess blunders. Scores were converted to the player-to-move perspective before applying the existing tested classifier.

The two Tal Club v1 failures are the same position (development sample09,37plies), repeated under seeds317and9029, not two independent tactical situations. Its selected move has moving-side score−715 at both depths; best scores are−95 and−325, respectively. Both therefore exceed the200 threshold. No confidence interval or gate pass was computed. Equal observed zero failures for Fischer and Strong levels does not establish equality of underlying risk or the Club protocol's required improvement.

## Execution and audit trail

The prospectively reviewed schedule used the exact original experiment/Tal/Fischer worker bundles, unchanged Club600ms/Strong2000ms limits, fresh Node threads per decision, original Node/machine identity and two development seeds. Candidate/baseline order alternated by sample/seed parity. All12 existing development positions were used, including documented-book choices if any; no result was omitted. No new game was continued or rated.

Reference results came from the completed development feasibility exercise, with unchanged E1 at independent depths3/4, exact legal-root coverage and10mnode caps. The rehearsal verified every reference input and source/bundle hash before executing candidates. Manifest and exclusive start/result files cover every scheduled decision. After execution, all131 current source hashes,24 reference record hashes, runner and reference-manifest hashes still matched. `classifications.json` retains each chosen move, both exact reference comparisons, category flags and classification for all192decisions.

Code and TypeScript reviewers approved the concrete protocol/harness before execution. No product code changed; the evidence-only harness and outputs are retained in `2026-10-02-tactical-rehearsal-evidence.tar.gz`. Full reference and original worker bundles are retained in the adjacent reference-feasibility and supplemental evidence archives. No new full product-test claim is made; the last product revision remains88f62c3 with1,093tests passing.

## What remains

The isolated Fischer failure is still unresolved and its original schedule remains stopped. The supplemental diagnostic games and this rehearsal cannot replace or rescue it. No engine change is justified solely by the timing incident.

A durable validation runner still needs synthetic fault-injection tests for omitted/duplicated/tampered schedules and results, immutable final-submission and one-attempt enforcement, reference eligibility freezing and independent anonymous review output. The current evidence harness is not that validation runner. No held-out partition or validation seed was inspected or generated. Final qualification also requires complete-game evidence under a valid prospective programme, owner blind-personality comparison and actual-device checks. New rated calibration and any release remain separate gates.

Final independent code and TypeScript audits approved the report. They verified all192 unique scheduled decisions/classifications and start markers,24decisions per opponent/level/side, legal moves, execution order, all131source and24reference hashes, and recomputed the two-depth moving-side classifications. No discrepancies or omitted failures were found; no search or validation data was accessed by the auditors.
