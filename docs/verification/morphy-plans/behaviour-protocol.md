# Plans-v1 behaviour protocol — 12 September 2026 BDT

Frozen fixture identities before policy implementation. This is a designed Morphy-inspired
playing policy, not a new learned model or evidence of perceived human style.

## Predetermined positions and chess properties

All positions also get rank-reflected, colour-swapped checks. No historical book is injected
for these off-book decisions. Multi-turn traces use legal opponent replies, recorded verbatim.

| Name | FEN | Required chess property |
|---|---|---|
| unique-mate | 7k/8/6K1/6Q1/8/8/8/8 w - - 0 1 | Qd8# outranks plans |
| free-queen | 4k3/8/8/8/8/8/q7/R3K3 w - - 0 1 | Rxa2 wins the undefended queen |
| poisoned-pawn | 3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20 | Qxd5 loses the queen to Rxd5; reject it |
| recapture | 4k3/8/8/8/8/8/3q4/3R2K1 w - - 0 20 | Rxd2 wins the queen |
| development | r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3 | Bring home minor pieces out on successive turns; do not prefer queen sorties |
| central-break | r2qkb1r/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9 | Safe d4 opens the centre against the central king; ensuing turns increase line access |
| coordination | r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16 | Add distinct useful king-area participants/open rook files across turns, without rewarding checks alone |
| pinned | 4r1k1/5ppp/8/8/8/8/4N3/4K2R w - - 0 20 | Ne2 is pinned to Ke1; its pseudo-attacks do not count |
| ending | 7k/7p/8/8/8/8/P7/KR6 w - - 0 30 | Active-pieces mode uses complete neutral choice, no attack bonus |

## Designed policy, fixed before any strength measurement

The root search reuses neutral evaluation and quiescence. Every root child gets a full window
and a fresh transposition table; all legal roots must finish at the same depth before publication.
Incomplete deeper iterations are discarded. Candidate scores use the mover's perspective;
returned AiResult scores use White's. Neutral fallback is the highest complete neutral score,
with stable legal/capture ordering. With no completed depth, use a legal neutral fallback.

Modes are recomputed from the mover's position, in this precedence:
- Active-pieces if fewer than three own N/B/R/Q pieces or own non-pawn material <1300cp.
- Develop if fullmove <=15 and at least one own N/B remains on its home rank.
- Open-centre if no own home minor remains, own king is on home rank and file a/b/c/g/h,
  opponent king is on file d/e, and an own pawn remains on file d/e.
- King-attack otherwise. Target is the opponent king square; centre target is files d/e.

Progress compares the resulting board with the original board from the same mover's viewpoint:
- Develop: +110cp per reduction in home minors; +140 castling; -35 for another move of an
  already developed N/B; -80 for a queen move. No remembered move count is claimed.
- Open-centre: +150 for a d/e pawn advancing into ranks3–6 and either capturing, double-moving,
  or contacting an enemy pawn diagonally; +10 per additional legal B/R destination (each piece
  capped at8); +25 per additional distinct N/B/R/Q piece legally reaching the king area.
- King-attack: +80 per additional distinct N/B/R/Q king-area participant; +8 per additional
  distinct reachable king-area square; +50 per additional useful rook on an open/semi-open file.
- Active-pieces: zero.

King area uses the adjacent squares (enemy-king captures are excluded). A contributor must have a legal move into
that area, not merely a pseudo-attack: absolutely pinned/non-contributing pieces are excluded.
Own occupied destinations do not count; pawn/king moves never inflate attacking-piece counts.
Useful rook files have no own pawn and at least three legal rook destinations on that file.
Access and attacker deltas may be negative. Sum the selected mode's terms, clamp to [0,240]cp.
Only neutral candidates <=100cp below the complete neutral best can receive this bonus.
Rank by neutral+bonus, then neutral score; exact remaining ties use the existing historical
seed/FEN/ply hash and stable root order. If all eligible bonuses are zero, keep neutral fallback.
Mate-extreme neutral results bypass plans and retain the best neutral mate score.

One deadline includes book, neutral search and plan work: Casual200ms/depth1, Club600ms/depth2,
Strong2000ms/depth4. Reserve30ms inside that deadline for feature computation/ranking; never add
it to the budget. Check deadline before/after each candidate's feature computation and before
publication. If ranking expires, discard all rankings and return the complete neutral result.
Book continuations use an independent exact copy of the frozen v3 legal filtering, hash,
occurrence-weighted selection and boundary convention; no v3 off-book search is invoked.

Diagnostics must report actual production decisions, mode/progress, completed neutral depth,
neutral loss, book/plan/neutral/mate/deadline fallback reasons, real elapsed time and per-level
plan application/fallback counts. Compare Classic descriptively with fixed random seeds.
Strength measurement is a separate task using morphy-plans-paired-v1, START and exact v4 identity.

## Pre-measurement fixture corrections after first RED/GREEN cycle

The original central-break position has Be6 attacking Bc4. d4 leaves that bishop hanging;
neutral complete depth2 scores it -265 vs best+60 (325cp loss). Keep this exact position as
`guarded-centre`, requiring rejection of d4; do not relax the100cp guard. The corrected
`central-break` position is `r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9`:
Black's bishop remains c8 so the intended break does not abandon Bc4 to Be6.

The original pinned Ne2 was too far from Kg8 to contribute even without a pin; Rh1 legitimately
reaches h7. Add `4r3/8/8/8/6k1/8/4N3/4K2R w - - 0 20`: Ne2 pseudo-reaches g3/f4 near Kg4 but is
pinned to Ke1. Compare with the same board without Re8: the unpinned knight adds one contributor.
These corrections are chess-fixture corrections before new expectations, not passing-policy selection.

## Pre-measurement design ruling: central-break priority

With the corrected c8 bishop fixture, d4 is within the guard: -30 vs best+60 (90cp loss).
The initial70cp break term yielded only60cp net and lost to Qe2 (+55 neutral,+50 access).
The controller approved a deliberate150cp central-break priority to implement the approved
immediate useful-break preference, not a guard relaxation or measured-strength tuning. This is
the final plans-v1 coefficient; all other weights,100cp guard and240cp maximum remain fixed.
The unsafe original325cp-loss d4 must still be rejected. Cost: possible lower playing strength,
to be measured from fresh complete games later. No calibration has begun.

Predetermined follow-through: after central d4 and legal ...exd4, recover on d4 with a minor
piece while retaining open-centre; after coordination Bxe6 ...fxe6, add another king-area piece.
Both-colour traces include these responses and subsequent production decisions. Also retain
balanced coordination fixture `r2q1rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16`:
the original fixture omitted Black's queen and remains a materially uneven descriptive case.


Feature legality correction before measurement: hypothetical post-check mover boards can cause
board.ts to enumerate an enemy-king capture (ordinary game turns never permit that position).
Plans-v1 filters such moves before all feature counts. Regression: white Bb6 checking black Kd8
has one reachable area square c7 and seven legal bishop destinations; Bd8 is never counted.
This adds no check-only term. The original board/search/version1–3 policy remains unchanged.


Common deadline is also passed as optional fifth searchRootCandidates argument: the root search
uses min(start+remainingMs, absoluteDeadline), and plans-v1 supplies overallDeadline-30ms. This
prevents time spent between budget calculation and search setup from extending the common budget.
Standalone four-argument consumers retain the ordinary relative budget.
