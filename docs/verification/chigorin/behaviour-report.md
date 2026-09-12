# Chigorin playing-policy evidence — 13 September 2026 BDT

Task1 implements a separate `chigorin/version1/chigorin-plans-v1/seeded-per-ply-v1` policy.
It is supported internally and remains unrated pending independent review and fresh measurement.
Classic and Morphy versions1–4 remain unchanged; the existing dispatcher adds an id-specific
Chigorin branch before Morphy version dispatch. Rating eligibility now also requires the correct id.

## Specified behavior

The declared fixtures are in `behaviour-protocol.md`; retained diagnostics are in
`behaviour-decisions.json`, reproduced by `node --import tsx scripts/chigorin-history/behaviour.ts`.
Club fixed-clock results use complete depth2, seed9 and ply30, with no book match:

| Position | White choice | Black reflected choice | Neutral loss (cp) |
| --- | --- | --- | --- |
| Early development | Nf3 | Nf6 | 0 / 0 |
| Balanced supported knight | Nd5 | Nd4 | 0 / 0 |
| Central contact | d4 | d5 | 90 / 90 |
| Attack coordination | Bxe6 | Bxe3 | 0 / 0 |
| Knight ending | Ne4 | Nd4 | 20 / 20 |

Multi-ply tests cover successive home-minor development after a6/d6, d4 exd4 Nxd4,
and Bxe6 fxe6 Ng5 (plus color reflections). The latter changes the participating attacking
piece after an exchange; it does not merely count multiple squares attacked by one piece.
The balanced knight fixture was added during review without changing policy coefficients;
the original materially imbalanced fixture remains as a separate tactical check.

Classic choices are retained descriptively. It agrees on some natural moves and differs on
others; no disagreement percentage is used as a success criterion. These are constructed chess
positions, not claims that Chigorin historically played each generated move. Automated checks
establish specific behavior and cannot establish the owner's perception of style.

## Bounded priorities and tactical gates

- Legal knight mobility earns10cp per safe destination/activity unit; central placement adds
  four units; a pawn-supported advanced central square earns85cp only if enemy pawns cannot
  attack it now or by a legal immediate pawn move. Absolutely pinned knights have no legal
  mobility and cannot earn outpost credit.
- Legal central pawn pressure earns45cp per added attacking piece/pawn and target pair. A
  useful pawn contact earns165cp only with improved legal pressure or opened line access.
- Development favors home minors100cp and castling135cp, discourages an early queen move85cp
  and repeat minor movement40cp. Central-break bonuses wait until development mode is over.
- Coordinated attacks favor added distinct legal attackers115cp and king-zone squares6cp.
  Attack mode needs sufficient non-pawn material, a flank home-rank king, no check, at least
  two immediate shield pawns and no undeveloped home minors. Endings keep knight activity.
- Total bonus is clamped0–240cp. Only complete-depth neutral alternatives within100cp of best
  qualify. Complete mate scores use neutral best; free queens and poisoned captures remain
  tactical checks. White-perspective public scores and side-to-move root scores stay separate.

All ranking must complete within the same production deadline;30ms is reserved from the root
search budget. Partial ranking is discarded for the completed neutral fallback. No completed
iteration also uses a legal neutral fallback. Terminal moves are null. Seed, ply and serialized
position drive deterministic choices at equal completed depth; real elapsed time can change
the completed depth on different hardware.

Production-clock spot checks on this Mac, two off-book positions per level: Casual5.9/7.6ms
at depth1, Club49.2/65.0ms at depth2, Strong1970.7/1950.6ms at depth3/4. All returned complete
style decisions within the200/600/2000ms limits. These are observed samples, not a universal
runtime guarantee; explicit synthetic expiry tests cover fallback during search and ranking.

## Verification

44 focused tests passed across Chigorin corpus/policy and preserved Morphy style/plans suites.
The source corpus test rebuilds all688 legal games and asserts exact book equality/counts after
lossless compaction. Identity validation,100 seeded weighted book choices, both-color tactics,
terminal results, deterministic replay, pinned knights, exposed kings and partial-ranking expiry pass.
Frontend/server typecheck and scoped lint pass. Production build initially failed the old2MiB
worker-cache ceiling: readable lossless key compaction reduced the worker from3.51MB to2.49MB.
The controller raised the explicit cache limit to3MiB; the production build passes and precaches
all15 entries (2865.82KiB). Full offline browser journeys remain an integration gate.

Strength calibration, actual-app selection/Resume/records/offline journeys and independent review
are subsequent gates. No ratings are inferred from these behavior fixtures or reused from Morphy.
