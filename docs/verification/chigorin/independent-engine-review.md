# Independent Chigorin Task 1 engine/corpus review

Reviewed 13 September 2026 BDT. Scope: `22853d2..b523790`, approved Chigorin design,
Task 1 report, importer/runtime book key/policy/opponent dispatch, behavior tests and retained evidence.
The working tree had no staged or unstaged changes at initial inspection. No production source was edited.

**SPEC: PASS for Task 1 and freeze/calibration readiness.**
**QUALITY: APPROVE.** No actionable findings above the confidence threshold.
These verdicts do not approve a rated release or replace the remaining integration/measurement reviews.

## Implementation review

- Exact `chigorin / 1 / chigorin-plans-v1 / seeded-per-ply-v1` identity and unsigned seed validation;
  id-specific dispatch precedes Morphy version dispatch. Chigorin remains unrated pending measurement.
  The only old engine-file change is that dispatch addition; Classic and all old Morphy playing
  implementations remain unchanged. Rated eligibility is correctly restricted by id.
- Runtime imports the compact book alone. Legal continuations are filtered against the current
  position and selected using recorded occurrence counts, never substituted from Classic/Morphy.
  The reversible board key retains canonical side/castling/legal-en-passant identity.
- Off-book policy contains substantive knight, central-contact, development and distinct-piece
  attack terms. It recomputes from position, seed and ply, without hidden plan memory. Legal move
  generation excludes absolute pins from knight mobility and central pressure; pawn challenges
  conservatively disqualify outposts. King shield/material/development gates constrain attack mode.
- Neutral root search publishes only completed iterations with exact mover-relative alternative
  scores. Candidates must be within 100cp of best; summed positive preference is capped at 240cp.
  The shared deadline reserves 30ms from search; expired/incomplete ranking discards all style
  and returns the completed neutral fallback. Complete mate scores use the neutral best move.
  Public score conversion remains White-relative. Terminal board/50-move/material cases return no move.
- Determinism is appropriately stated as identity/seed/ply at equal completed depth. Real elapsed
  time may change completed depth; the retained report does not promise cross-device identical moves.

## Corpus and evidence audit

Read the full importer and surrounding board/search dependencies rather than the generated JSON diff.
The existing 44 passing corpus/policy/old-Morphy tests and full-book reproduction were inspected as
retained evidence; they were not unnecessarily rerun.

Independent read-only checks reproduced:

- ZIP SHA256 `a0f2d72830ae1b94bb16e5ea293f5347f6ec6f56080fdaa80ac246918c4c43df`.
- PGN SHA256 `2417f6cd5cc94ec88a07b529c0b610ac9b06de5673db0f72d56670f4a2b166d0`.
  Extracting `Chigorin.pgn` from that ZIP produces the same hash.
- 688 retained games / 688 unique content ids: 351 White and 337 Black.
- 26,262 compact positions and 30,101 summed continuation occurrences, matching the manifest.
- Exact named-player admission, explicit rejection reasons, legal main-line replay, duplicate checks,
  pinned source fingerprints and compact/full-key collision checks are present in the importer.

The [PGN Mentor catalog](https://www.pgnmentor.com/files.html) and
[GM Bryan Smith article](https://www.chess.com/article/view/the-chigorin-queens-gambit-a-history-part-2)
were opened independently. The latter supports the stated qualitative knight/light-square/attacking
context. The implementation correctly calls the off-book policy designed, not learned, and does not
claim that legal replay independently authenticates historical attribution.

## Targeted independent chess checks

Executed directly through the production TypeScript modules with a fixed clock, without modifying
source or rerunning the suite:

1. Both colors: pinned bishop central-pressure exclusion using
   `4r2k/7p/8/8/8/3p4/4B3/4K3 w - - 0 30` and vertical/color reflection: pressure 0.
2. Both colors: pinned e2 knight (the declared absolute-pin fixture): knight activity 0.
3. Both colors: supported d5 knight with a black pawn on c7 can be challenged by c6:
   `6k1/2p5/8/3N4/2P5/8/8/6K1 w - - 0 20` gives 0 outposts; removing c7 gives 1.
   Eight feature assertions passed across these four checks and their reflections.
4. The declared attack fixture lacks Black's queen. As a supplemental sensitivity check, restore
   it on d8: `r2q1rk1/ppp2ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 0 16`.
   Both colors still choose Bxe6 / Bxe3 at Club complete depth 2 with neutral loss 0 and +115cp
   distinct-attacker term (+6cp area term). The White sequence remains Bxe6 fxe6 Ng5; Ng5 also
   has neutral loss 0 and +115cp attacker term. This resolves the fixture-imbalance concern without
   changing coefficients or declared criteria.

The retained fixed-clock choices, multi-ply tests, independent pin/outpost checks and balanced-attack
sensitivity check support the specified behavior. They do not establish perceived personality or
playing strength. The six retained real-clock observations are samples, not universal deadline proof.

## Remaining gates outside Task 1

Freeze the complete playing-source fingerprint before calibration. Do not change policy/book/coefficients
while measuring. Require the approved complete-game checkpoints for every level before rated setup.
Actual-app selection, Resume/history, compatibility, offline operation and final release checks remain
with integration. No source push, deployment or additional release decision is implied by this review.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 0 | pass |
| LOW | 0 | pass |

Verdict: APPROVE — Task 1 is ready to freeze for independent calibration; rated release remains gated.
