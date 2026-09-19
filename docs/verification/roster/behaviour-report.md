# Task1 behavior evidence — 19 September 2026 BDT

Pure roster engines only; no app integration, measurement, publication or deployment. The approved
loss limits remain Spassky100, Tal150, Fischer50; bonus caps240/360/240. Production limits remain
200/600/2000ms with30ms reserved for ranking. Complete neutral mate takes priority, incomplete
search depths are discarded, and an expired/partial style ranking returns the neutral fallback.
Seeds and move identities validate; legal occurrence-weighted books precede off-book policy but
follow terminal detection. Features use legal reach, including pin restrictions.

## Actual off-book choices

`behaviour-decisions.json` retains42 fixed-clock comparisons plus9 production-clock decisions.
`behaviour-sequences.json` retains10 both-color two-turn lines and6 real-clock Tal diagnostics.
All fixed-clock lines use Club depth2, seed9, initial ply30; opponent replies are explicitly recorded.

- Spassky: Nc3 a6 Nf3 (reflected Nc6 a3 Nf6) develops successive home minors. In the ready-centre
  case, d4 exd4 Nxd4 (d5 exd5 Nxd5 reflected) opens the centre at90 neutral loss, while Tal/Fischer
  choose Ng5/Ng4. Ready-attack Bxe6/Bxe3 increases coordinated access. These are distinct
  buildup/central/attack predicates, not just renamed weights.
- Tal: the accepted supplementary fixture chooses Rxf6/Rxf3 at60 neutral loss, while Fischer and
  neutral search choose Bxe2/Bxe7. After gxf6/gxf3, Tal plays Qxh7#/Qxh2#. Immediate material
  deficit is180 (rook500 for knight320); the offer helper returns80 after accounting for possible
  immediate pawn recapture. The opponent need not accept, so this is a speculative preference
  within the guard, not a neutral-best forced win. Removing the supporting bishop suppresses the
  style bonus and rejects this offer. The compensation test checks immediate material-losing
  acceptances for two surviving legal attackers and increased king exposure; it does not prove
  every defensive line. Neutral complete-depth search still controls the candidate-loss guard.
- Fischer: Bxc5 Re8 Ng5 (reflected Bxc4 Re1 Ng4) sustains useful piece pressure; the initial
  choice differs from Spassky/Tal's queen exchange. Conversion advances d6 then Kd5 after Kf8;
  the mirrored d3/Kf1/Ke4 route supports the passer. A favorable rook capture receives conversion
  preference, while the unsound queen capture receives none. Earlier bishop-development Bc4/Bc5
  differs from the other two engines' knight development.

## Failures preserved and interpretation limits

The initial Spassky centre choice Ng5 failed the intended central-break priority; the legal-line
predicate was corrected before final evidence. Modified Tal–Botvinnik Nf4 failed the150 guard
(loss285) and remains rejected. The first Rxf6 fixture was neutral best (insufficient evidence);
adding an e4 pawn produced30 loss but did not distinguish Fischer. The recorded single-piece
fixture exploration then found the e2-pawn fixture with60 loss. No strength results informed
coefficients. `exploratory-offers.jsonl` retains discoveries from the earlier policy; the protocol
records the later compensation correction, so those diagnostics are not final-policy evidence.

Removing the bishop originally still admitted an unsupported offer through generic activity
bonuses. The corrected policy gates all offer preference on surviving compensation, assessed
only after immediate material-losing acceptances. All earlier fixed fixtures were rerun. Exact
reflection initially failed for tied queen checks and king routes; tests now retain actual routes
and verify the declared progress rather than claim identical tie ordering.

In final production-clock diagnostics the supplementary speculative offer is selected at Club
in both colors. Casual depth1 and Strong's completed depth3 select Bxe2/Bxe7; deeper evaluation
and guard enforcement can override style. Strong uses approximately1970ms here; this is diagnostic
machine timing, not a universal latency promise. No automated fixture proves human-perceived
personality. Fresh frozen complete-game measurement and independent behavior review remain
required before rated integration.

## Verification

Focused coverage:14 behavior tests and4 corpus tests, including full-source rebuild in an asynchronous
child process. Tests cover actual both-color multi-turn choices, compensation/unsound analogues,
mate/free queen, pins, favorable/harmful captures, terminal-before-book, weighted occurrences,
illegal book entries, deterministic identities, incomplete depth and expired partial ranking.
Full corpora rebuild every legal history and every exact compact-key/continuation occurrence.
Frontend/server typecheck and scoped source/script lint pass. Independent review identified that
the initial shared checks omitted the roster scripts. The controller extended Task1 ownership to
add them permanently to ESLint TypeScript patterns, the tooling TypeScript project, and canonical
lint/format commands. Canonical `npm run lint`, `npm run typecheck`, `npm run format:check` and
the reviewer’s whole-repository ESLint invocation now pass. Source, tests, scripts and books
are checked with the repository formatter. Books are reproducibly formatted by the importer and
fingerprinted as exact written bytes; their eventual combined worker/cache size needs Task2 testing.


## Independent-review conversion correction

The initial favorable-position gate covered only Fischer's trade term; king, passer and file
rewards could still activate with an unfavorable neutral score or abandoned attack. Four new
both-color regressions failed before the fix (negative-score king bonus140; blocked-attack passer
bonus28). All conversion-specific rewards now share score>=80, retained material and retained
legal attackers. Ordinary development remains separately scored. Guard50 and cap240 are unchanged.

The14 behavior tests pass after the fix, retaining the actual positive conversion sequences.
Both evidence JSON files were regenerated; canonical lint, typecheck and format check pass.
The unchanged4 corpus tests/full replay remain covered by the prior verified checkpoint and were
not unnecessarily rerun for this policy-only correction. No ratings or integration were changed.
