# Neutral coaching dead-position repair — 29 September 2026 BDT

After experimental Tal/Fischer integration, the game correctly ended when only same-color bishops
and kings remained, but neutral coaching still used the legacy material rule. It could display a
material advantage after the draw and misgrade the preceding capture. This was discovered during
read-only review of the first frozen development batch; no playing source changed during that run.

The fix isolates the required legacy root-search helpers in `src/engine/review-search.ts`, changing
the dead-position predicate at root, ordinary search and forcing search. Every alternative still
uses a full search window, and only an entirely completed common-depth iteration is published.
The reviewer identity advances to `custom-neutral-v3`, invalidating old derived reviews. The
review-v2/hint-v1 budgets remain 3/180ms and 4/900ms. Terminal evidence requires the correct White-relative
score, no move, depth zero, complete status and no alternatives. Draw scores normalize signed zero.

The old playing search, books, opponent policies, ratings and receipts are unchanged. A root-only
or display-only correction was rejected because the before-move alternative would remain wrong.
Using the E1 search directly was also rejected as a broader change to review completion, timing and
history semantics. This repair does not claim to solve inherited repetition-search limitations.

## Evidence

Both-color drawing-capture regressions failed before the repair with nonzero material scores.
The six focused tests pass: both-color drawing captures and terminal review/hint results; rejection
of old reviewer identities and malformed terminal scores/moves/depth/completion/alternatives;
both-color forcing continuations; and checkmate precedence at halfmove 100.

The forcing fixture `7k/8/6P1/8/8/4B3/8/K1B5 w - - 0 1`, move `g7+`, produces zero at completed
depth one. Independent review removed only the forcing dead-position check in an in-memory mutant;
its score became 640. The reflected Black fixture also produces zero. Legacy search remains nonterminal
in the bishop-only fixtures, confirming policy isolation. Code and TypeScript reviewers inspected
the isolated change and the added tests; no blocking findings remain.

Final checks: 121 test files / 1082 tests pass; typecheck, lint, formatting and diff checks pass.
The experimental build succeeds and all five engine workers are included in the offline cache.
Four native-worker browser journeys pass across desktop and mobile emulation, covering live neutral
coaching, rejection of opponent-score contamination and recomputation after legacy reload. This is
not physical-phone evidence. Full logs and the initial failing regression are retained in
`neutral-dead-position-logs.tar.gz`.

## Measurement preservation

The initial Tal Casual development batch completed all 40 games at frozen source `521fef2`:
35 wins, 3 draws and 2 losses, candidate score 0.9125, paired development interval [0.8375, 0.975].
All results are legal terminal outcomes; no attempt was replaced. These are exploratory Casual
results, not strength qualification, a new rating or perceived-style evidence.
The original complete run, manifests, worker bundles, start markers and log are retained in
`tal-casual-development-521fef2.tar.gz` (SHA256
`f977f91741d1c8c7deeac02816d997722181d2d73aff39ec93ee99bc1fcfe5dd`).

To continue the other five already-frozen batches without source drift, an ignored git archive of
`521fef2` retains the benchmark sources within the repair worktree. All 129 source fingerprints in
each of the six original manifests and every frozen worker bundle match. The unchanged runner uses
that snapshot as its working directory and writes to the original run directories. Original start
markers, seeds, manifests and bundles remain authoritative; unresolved attempts cannot be rerun.
Matches remain sequential, with no competing tests or builds. No new validation positions were read.
The snapshot comparison is retained in `frozen-snapshot-521fef2-audit.json`.

This is local work only. Physical-device checks, owner blind comparisons, final strength/tactical
validation and release gates remain separate.
