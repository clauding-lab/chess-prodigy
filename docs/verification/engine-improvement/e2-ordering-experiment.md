# E2 capture ordering experiment — 28 September 2026 BDT

`next-neutral-ordered-v1` is an inactive copy of the E1 reference, which remains byte-for-byte
unchanged. The sole playing change subtracts the moving piece's value when ranking captures of
the same victim. Preferred previous root moves and promotion ordering remain. This affects the
order in which possibilities are explored; it does not change evaluation, legal moves or the
requirement to complete every root alternative before publishing comparable scores.

No existing opponent or worker imports this experiment. Different order can choose a different
move among equal best scores and can encounter forcing limits differently. It therefore has its
own policy identity and cannot replace any saved opponent or rated configuration.

## Fixed-work evidence

`compare-ordering.ts` legally replays the frozen12 development positions, verifies original data
and cohort fingerprints, and compares complete forcing depth3 results with a constant clock and
5million-node cap. It reads no validation positions. Incomparable results are reported separately;
exit0 alone is not acceptance. Both retained runs contain12/12 fully comparable results and zero
candidate-score mismatches. Candidate maps include every legal root move, not merely the selected
best move. No timing claim follows from the constant clock or concurrently running browser checks.

Across the12 positions, nodes fell from368806 to351375:17431 fewer, or4.7%. Ten positions used
fewer nodes; two used156 and64 more. This is an uneven development-cohort improvement, not a
population claim. Complete-game strength, perceived personality and actual-device benefit remain
unmeasured.

The first harness execution completed while a TypeScript policy-literal union error was being
checked. Its exact source is retained as `e2-ordering-fixed-v1-harness.ts.txt`; the type-only
correction did not alter runtime logic. `e2-ordering-fixed-v2.json` is the fresh rerun whose six
source fingerprints match the corrected harness and current experimental source.

## Verification and limits

- Experimental import initially failed before implementation existed. New five checks and the15
  E1 safety/oracle tests passed.
- Independent TypeScript review required explicit completed depth3, forcing phase and no
  interruption before claiming depth3 equivalence. The strengthened five tests passed.
- Independent code review verified the narrow source diff, all12 exact score maps and source hashes;
  no findings. Root tie changes and forcing-limit differences remain explicitly disclosed.
- The timed profiler's explicit reference/ordered routing failed its new test before implementation;
  all seven profiler tests subsequently passed. Combined engine checks27/27, canonical typecheck
  and full source lint passed. Full unit rerun and isolated timed comparison are separate gates.

Do not call this a stronger engine or activate it in normal play based on node counts. E2's next
optimization is still gated on measured benefit, fixed-work correctness and retained tactical
behavior; later strength/personality/migration/measurement gates remain mandatory.

Fresh full unit/integration verification:101files/927tests passed. Canonical frontend/server
TypeScript, full source lint and formatting passed. Final harness TypeScript review found no new
issue. These are local implementation checks, not timed-strength acceptance.
