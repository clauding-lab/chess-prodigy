# Chigorin behavior protocol — declared 12 September 2026 BDT

Declared before the policy implementation and before any strength games. These are constructed
legal chess positions, not claimed Chigorin historical moves. Each is tested with colors reflected
vertically, and with the book confirmed absent. Club depth uses a fixed clock for reproducible
complete-depth decisions; production deadline checks use both controlled and real clocks.

| Case | FEN | Required chess behavior |
| --- | --- | --- |
| Development | r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3 | Develop a home minor, repeat with legal a6/d6 replies; avoid early queen excursions. |
| Knight outpost | r4rk1/pp3ppp/2p1b3/4p3/2PP4/2N1PN2/PP3PPP/R2Q1RK1 w - - 0 16 | Improve a knight toward supported d5/e5 central activity when tactically safe. |
| Central counterplay | r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9 | Play d4 to contact the e5 pawn; after exd4 recapture on d4. |
| Coordinated attack | r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16 | Add legal king-zone access by a second distinct piece or a forcing capture that improves coordination; follow the reply. |
| Knight ending | 7k/7p/8/8/3P4/2N5/P7/6K1 w - - 0 30 | Useful central knight movement, no manufactured king attack. |
| Absolute pin | 4r2k/7p/8/8/3P4/8/4N3/4K3 w - - 0 30 | Pinned e2 knight contributes no legal knight mobility/outpost reward. |
| Mate | 7k/8/6K1/6Q1/8/8/8/8 w - - 0 1 | Qd8#; mirrored mate for Black. |
| Free queen | 4k3/8/8/8/8/8/q7/R3K3 w - - 0 1 | Rxa2; preserve White-perspective score sign. |
| Poisoned pawn | 3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20 | Never Qxd5, which loses the queen to the rook. |

Style eligibility requires a completed root iteration, nonmate score, neutral loss <=100cp and
bounded bonus <=240cp. Every winning or losing mate uses the neutral best move. No complete
iteration or partial deadline-expired ranking publishes style. Search and ranking share each
production budget, reserving 30ms for ranking. Determinism covers identity/seed/ply with equal
completed depth; wall-clock depth can vary by device. Compare Classic descriptively, with no
mandated disagreement rate. These checks establish specified behavior, not perceived personality.

## Supplemental review checks — 13 September 2026 BDT

The original knight example contains a material imbalance; it remains a tactical central-knight
check. A balanced middlegame was added without changing the coefficients:
`r1bq1rk1/pp2bppp/2n2n2/2p1p3/2P1P3/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 12`.
Expected Nd5 (and mirrored ...Nd4), supported by pawns with no immediate legal enemy-pawn
challenge. This better separates outpost behavior from capturing an unprotected pawn.
An exposed-own-king variant removes f2/g2/h2 and must disable coordinated-attack mode.
King safety requires no check, a flank home-rank king and at least two immediate shield pawns.

Book representation may be compressed losslessly before freezing. Counts, accepted-game facts and
canonical legal-en-passant distinction must remain identical; importer checks full-key bijection.
