# Durable tactical runner — 2 October 2026 BDT

Implement the remaining tactical runner mechanics from the accepted 29 September contract, under the owner's autonomous-local-work instruction. Test only synthetic inputs; do not load or execute the actual validation partition. No engine policy, application, rating, original failed schedule or release change.

The deliverable is a reusable frozen tactical runner API, production worker adapters and tested report assembly. There is deliberately no command that automatically selects/opens the real validation dataset. This does not implement the separate 1,600-game qualification execution or authorize a final submission. The immutable final manifest records that complete-game recipe alongside the tactical settings so that a tactical-only result can never claim programme qualification.

## Frozen inputs and schedule

Freeze a supplied raw dataset through a reader callback against its independently supplied SHA-256 and expected count. Validate every record {id, gameId, history, fen}; legally replay from START, reject post-terminal moves and mismatched roots, preserve all records, and retain terminal exclusions explicitly. No zero-eligible manifest. Generate all 16 decisions and 2 references per eligible position. Development seeds 317/9029; final tactical seeds 19471/78157. Fixed levels Club/Strong, opponents Tal2/Fischer2, own-v1 comparators, parity-alternating order from the accepted contract. Settings and identities are fixed by the runner, not caller-overridable knobs.

Context fingerprint must bind source/books/worker bundles/settings/hardware through the caller's adapter. Store the immutable manifest and exact raw dataset. Verify their hashes and reconstructed schedule before execution or assembly; reject added, removed or edited tasks. Output directories are exclusive; no overwrite or automatic restart.

## One attempt

For final purpose, atomically claim the constant coherent-v1 programme slot in a caller-provided durable registry before calling the dataset reader. A second output directory with the same registry cannot create a second submission. Failed reads, freezes, execution, or incomplete results retain that claim. Bind the completed manifest digest into a second exclusive registry record. The registry is an honest-runner safeguard within one durable registry, not protection against an owner deleting/copying state; operational final use must supply the repository's canonical retained registry.

Starting execution creates an exclusive run marker. A crash leaves it in place; subsequent execution refuses even if the first result is missing. Every task gets an exclusive start marker before its executor and a retained result/error after it. Stop on the first failed/invalid task. Capture structured worker failure evidence. Missing rows, extra rows, wrong identities, source-context drift or failed tasks make assembly inconclusive, never a reduced denominator. No automatic retry. Completion is not qualification.

## Validation and reporting

Reference results must reach forcing depth 3/4 without interruption, at most 10m nodes, exact finite coverage of every canonical legal root move exactly once, correct best score/move, root/history/perspective/policy/settings. Reference workers have a conservative 120s resource cap; reaching it is failure, not an altered score. Decision workers retain the production 15s cap and 600/2000ms budgets. Validate timing, selected canonical move, experimental provenance via the existing validator, and baseline move/detail consistency.

Revalidate stored evidence during assembly. Use the existing shared two-depth failure classifier and whole-source-game bootstrap. Report all four comparator/level groups, exact denominators, individual categories and intervals. Club/Strong statistical criteria may be reported separately, but programme qualification is always false. Emit an anonymized A/B review packet containing legal histories, exact references, moves and flags, with a separate private mapping. Do not leak opponent identities or worker-policy metadata into that packet. Independent human review, complete-game evidence, blind-personality and device checks remain separate gates.

## Required synthetic fault tests

Cover omitted/duplicate/extra/tampered rows, partial datasets, illegal/post-terminal histories, both-color score conversion, wrong reference policy/depth/coverage/score, wrong candidate provenance, modified baseline metadata, nonfinite/over-cap timing, context drift, crash after start, failed dataset reader, concurrent/second-directory final claim, overwrite refusal, failed-result retention, incomplete assembly and anonymous identity separation. No real validation samples or searches are needed for these controls.
