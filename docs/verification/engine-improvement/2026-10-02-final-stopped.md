# Final programme stopped by owner — 2 October 2026 BDT

The owner accepted the recommendation to stop the remaining complete games and review the failed
Club tactical criteria. The active process was terminated; it is no longer running. Idle-sleep
prevention tied to that process also ended. The live application and all engine policies are unchanged.

## Preserved disposition

- All 320 references and 2,560 tactical decisions completed. Every one of the 2,880 task records was
  revalidated, including its write-time hash, under the matching frozen source/machine/bundle context.
  Reassembly reproduced the exact stored tactical report.
- 67 of 1,600 full games completed and were legally replayed with every decision verified. There are
  68 start markers. `tal-strong-tal-33-b` is interrupted, with its unresolved start marker retained.
  The running game's unpersisted moves cannot be recovered; its marker is not a completed result.
- `owner-stop.json` records the explicit owner stop at 21:14:37 BDT. `programme-status.json` is a
  clearly labeled controller record of that cancellation, not a naturally completed programme.
- The final claim remains consumed. No automatic restart, replacement game, smaller-denominator
  strength estimate or qualification follows. The separate original Fischer Casual development
  failure also remains untouched.

The complete retained evidence, registry and run log are in
`2026-10-02-final-stopped-evidence.tar.gz`. `preserved-file-hashes.json` records SHA-256 fingerprints
of all 5,913 pre-existing evidence files before archiving. No existing evidence file was overwritten.
Archive SHA-256: `98d5accb288572f77441bcf8774d459ef4431dfbb943c7393b96f82d8d81edfa`.

## Tactical result

Each row has 320 decisions per side: 160 positions with two seeds. The positions come from 12 source
games, so the confidence calculation resamples those whole source games rather than pretending all
320 decisions are independent.

| Opponent / level | New failures | Old failures | Registered criterion |
|---|---:|---:|---|
| Tal Club | 2 | 2 | Failed: no observed reduction |
| Tal Strong | 2 | 2 | Met: no increase, upper interval endpoint zero |
| Fischer Club | 2 | 4 | Failed: upper interval endpoint zero; strictly below zero required |
| Fischer Strong | 2 | 2 | Met: no increase, upper interval endpoint zero |

Fischer Club's observed rate difference was −0.625 percentage points; its approximate interval was
−1.961 to 0 percentage points. The evidence does not clear the prospectively required improvement
threshold. This is not proof that Fischer is worse, and the tied Strong checks are not proof of equal
underlying risk. Completing more full games would not change this separate tactical result.

## Independent review

An independent reviewer first audited the anonymous packet without opening its private mapping:
1,280 pairs, every legal history/root, all 320 hash-verified exact references, every selected-move
comparison, all 399 move disagreements and both classification disagreements. No classification
errors were found. There were 18 failed decisions across 10 pairs, concentrated in three positions:
8 pairs failed on both sides and 2 on one side. Repeated seeds are repeated decisions, not independent
positions. The inclusive 200-centipawn boundary was applied correctly. These are judgments against
the frozen custom reference, not certified chess blunders.

Anonymous packet SHA-256:
`8e4c0bad40b08194d5373d433c91d66cde8df16caa6cbba68b463099135aad7c`.

After that anonymous phase, the reviewer explicitly unblinded the mapping and independently verified
opponent/level attribution, selected moves against hash-bound records, all four denominators, source-game
clustering, all 10,000 resamples and percentile endpoints. Every reported count and interval matched.
Tal's two failures came from the same position under both seeds, shared by old and new versions.
Fischer Club's two avoided failures came from one position under two seeds; some whole-game resamples
omit that improvement, making the upper endpoint zero. No search, tuning or edits occurred in either
review phase. Report integrity is approved; both Club criteria remain failed.

## Consequence

The current programme is incomplete and unqualified. No rating activation or release follows.
The owner-waived phone and blind-playing gates remain waived; technical criteria were not waived.
No candidate redesign or tuning was performed during this review. Any successor needs a stated new
hypothesis and fresh, independently reviewed validation evidence; the exposed positions/results
cannot be recycled as untouched validation or used to justify repeated attempts on this candidate.
