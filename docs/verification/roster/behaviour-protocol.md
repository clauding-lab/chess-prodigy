# Declared behavior protocol — 19 September 2026 BDT

Declared before new policy coefficients. All cases are tested as written (White) and with ranks
reflected and piece colors exchanged (Black); legal recorded moves must be absent in all three books.
The fixed clock completes the declared Club depth, with separate real deadline tests at every level.

| Case | FEN | Required actual behavior |
|---|---|---|
| Buildup | `r1bqkbnr/pppp1pp1/2n4p/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3` | Spassky develops successive home minors after a6/d6 replies, then supports central play |
| Ready centre | `r1bqkb1r/ppp2ppp/2np1n2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w kq - 0 9` | Spassky challenges centre with d4 and maintains activity after exd4 |
| Ready attack | `r4rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16` | Spassky adds coordinated attack; Tal strongly favors king-line access |
| Sacrifice | `r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8` | Tal may choose a compensated piece/pawn offer only when completed search admits loss <=150; must demonstrate an actual selected offer and useful continuation on a declared supplementary position if this position offers none |
| Unsound offer | `3rk3/8/8/3p4/8/8/8/3Q2K1 w - - 0 20` | Reject Qxd5, retain legal sound move |
| Bishop/file pressure | `r2q1rk1/pp3ppp/2n1bn2/2p1p3/2P1P3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12` | Fischer improves legal bishop/open-file reach or takes concrete tactical gain, sustaining pressure on following turn |
| Conversion | `6k1/5ppp/8/3P4/4K3/8/5PPP/8 w - - 0 30` | Fischer advances supported passer / king toward promotion, then maintains progress |
| Pinned bishop | `4r2k/7p/8/8/3P4/8/4B3/4K3 w - - 0 30` | No fictitious bishop reach; actual selected move remains legal |
| Mate | `7k/8/6K1/6Q1/8/8/8/8 w - - 0 1` | Complete mate precedes all style |
| Free queen | `4k3/8/8/8/8/8/q7/R3K3 w - - 0 1` | Rxa2, both colors |

No arbitrary losing trade receives a conversion bonus. Spassky loss/bonus limits100/240,
Tal150/360, Fischer50/240. Plans must differ in their predicates, not merely their coefficients.
Tal requires concrete compensation for offers; Fischer conversion requires material advantage,
remaining favorable neutral score and absence of immediate attack abandonment.
Book selection preserves occurrences; terminal draws stop before book lookup. Seed/ply identity
must validate. Incomplete search or partial/expired style ranking returns neutral fallback.
Additional fixtures will be explicitly recorded before testing them; failures remain documented.

Supplementary sacrifice declared before running it: Black to move in
`2r3k1/pp4bp/3p2p1/3Ppb1n/1qr5/P1N1B1PP/1P2QPBK/R1R5 b - - 1 21`.
This is an intentionally changed training fixture derived from the position before Tal's21...Nf4
against Botvinnik in1960 (White's a-pawn placed on a3, so it is not a historical claim).
Expected priority is an actual compensated king-line offer followed by recapture/continued attack;
Nf4 gxf4 exf4 is the candidate sequence, but completed neutral search must still admit it.

The modified Tal–Botvinnik fixture failed the neutral150-point guard at Club (Nf4 scored285
below best); reject it as a positive sacrifice acceptance fixture and retain it as a rejection case.
A second declared motif family tests a rook exchange offer on f6, opening g-file access and exposing
the black king: `3q1rk1/pp3ppp/5n2/3p4/8/3B4/PPP1Q1PP/5RK1 w - - 0 20`.
Tests may vary queen placement among e2/g4/h4 and bishop placement d3/c2 to isolate compensation;
no coefficients are selected from playing-strength measurement.

Resume exploration: the h4/d3 exchange motif is perturbed by adding a single pawn or knight
on an empty non-back-rank square to locate a genuinely speculative (positive neutral loss)
offer within the unchanged150 guard. These are exploratory fixture discovery, not holdout evidence
or strength tuning. The accepted case must subsequently pass color reflection and a concrete
opponent reply/continuation, with all coefficients frozen throughout fixture discovery.

Discovery accepted the e4 black-pawn perturbation:
`3q1rk1/pp3ppp/5n2/3p4/4p2Q/3B4/PPP3PP/5RK1 w - - 0 20`.
With unchanged coefficients Tal chooses Rxf6, neutral loss30, followed after gxf6 by Qg3+.
The rook-for-knight exchange loses180 material immediately; possible pawn recapture lowers the
immediate-recapture accounting deficit to80. This is genuinely non-neutral preference, not an
assertion that the sacrifice objectively wins. Mirror chooses Rxf3 gxf3 Qg5+ (different tied check).
Initial exact-reflection assertions failed for that check and Fischer's king route: Black chooses
Ke4 instead of Kd4. Both maintain the predeclared checking/king-activation priorities; preserve
these observations rather than changing policy to force geometrically identical ties.

The e4 variant did not distinguish Fischer: all three selected the exchange at Club. The already
recorded e2 variant from the same frozen-policy discovery is the stricter separation fixture:
`3q1rk1/pp3ppp/5n2/3p4/7Q/3B4/PPP1p1PP/5RK1 w - - 0 20`.
Its60-point Club loss should admit Tal but exclude Fischer by the existing50 guard. Follow-up
checks must still demonstrate useful attacking continuation in both colors.

A discovered weakness: removing the supporting bishop still selected the offer at130 loss via
ordinary activity bonuses, despite missing compensation. Corrected the predicate (guards and
coefficients unchanged): any net offer receives no style bonus unless every material-losing
acceptance leaves at least two surviving legal attackers and increases enemy king exposure.
The assessment now examines accepted positions, so the sacrificed rook cannot count as a surviving
attacker. Re-run all prior and new fixtures after this policy correction. The e2 positive sequence
ends Qxh7#/Qxh2# if the opponent accepts; declining remains possible, hence its positive neutral loss.

Independent-review correction: every Fischer conversion-specific reward (trade, passer, king and
file) must share the declared favorable-score/material/attack-retention gate. Regressions use the
post-d6 conversion position `6k1/5ppp/3P4/8/4K3/8/5PPP/8 w - - 0 31` with candidate Kd5/d7
and a rook-h1 addition with Ra1: positive500 allows reward; negative500 and below-threshold79 do
not. Attack-retention fixture `6k1/R4ppp/3P4/8/4K3/8/5PPP/8 w - - 0 31` makes d7 improve a
passer while blocking the rook's legal king-zone line. Both-color versions must receive no
conversion preference even at favorable500. Existing actual positive multi-turn choices remain.
