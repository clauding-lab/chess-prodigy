# Direct Morphy playing-plan implementation

Owner approved the Morphy-inspired direction, direct implementation in the actual app,
separate internal opponent identity to preserve old games, verification before deployment,
and fresh strength measurement before rated play ("ok", then "go on", 12 September 2026 BDT).
This supersedes the earlier requirement to learn every off-book preference and the separate
prototype/anonymous-lab prerequisite for this new design. The three failed learned experiments
remain rejected and preserved on codex/morphy-distinctiveness; their thresholds/results are not
rewritten or used to claim acceptance here. No failed model is imported into this implementation.

## Intended behaviour

The visible opponent remains Paul Morphy. New internal identity: attack-development version4,
engine plans-v1, randomPolicy seeded-per-ply-v1. Existing versions1/2/3 and their ratings stay exact.
Morphy keeps the frozen documented legal opening continuations and occurrence frequencies. Familiar
opening moves remain possible and must not be disguised. At non-book positions it selects a
position-derived plan, evaluates immediate progress toward that plan among tactically acceptable
moves, and carries the same goal forward while its board conditions remain applicable. There is no
hidden session memory, fabricated historical attribution, blanket sacrifice permission or new engine.

Four plan modes, evaluated from the mover's perspective:
1. Develop: early positions with undeveloped home-rank minor pieces prioritize bringing them into
   play and castling; discourage repeat moves with already-developed pieces and early queen sorties.
2. Open the centre: when development and own king safety permit and the enemy king remains central,
   prioritize useful central pawn breaks and increased bishop/rook access.
3. Coordinate an attack: target the enemy king's area with additional distinct attacking pieces and
   useful open/semi-open rook files; reward improved coordination rather than a check by itself.
4. Active pieces/endgame: with insufficient attacking material use neutral search, without artificial
   king-attack or development bonuses. This avoids forcing an obsolete plan throughout an ending.

Plans are recomputed from the actual position; goals persist while their conditions do. Do not claim
multi-turn memory or an exact reconstruction of historical thought. Pure plan functions expose mode,
target and individual progress terms for deterministic tests and retained diagnostics, not coaching.
Coefficients/conditions must be documented and frozen before strength measurement. Preserve the
existing neutral coach and never use opponent-specific values as neutral review evidence.

## Search and safety contract

Add a separate neutral root-candidate search entry point to search.ts, reusing private helpers while
preserving every existing search/Classic/old-Morphy body. Score all legal root alternatives at the same
completed search depth with full windows and a common elapsed deadline. Candidate scores are in mover
perspective; public AiResult scores remain White perspective. Discard an incomplete iteration in full.
A previous complete iteration remains usable. If none completed, return a legal neutral fallback and
do not apply plan ranking to partial or unevaluated alternatives. Proven immediate mate may return
early; proven mate results outrank style and prefer the best neutral mate score.

Production budgets remain Casual depth1/200ms, Club depth2/600ms, Strong depth4/2000ms. Include book,
root search and plan computation in one deadline. When time expires during plan ranking, use the
completed neutral result. Deterministic ties use the existing seed/position/ply identity; no ambient
randomness or added time budget. No change to Classic noise/book/search.

Only candidates within100 centipawns (one pawn of neutral engine score) of the best complete neutral
score may receive plan preference. This is an engine estimate, not a guarantee of sound play. Among
eligible moves, reward positive plan progress with a documented bounded maximum240cp; retain neutral
score as the other ranking term. No progress means neutral choice. Immediate mate and forced winning
mate bypass stylistic preference. Terminal positions return no move. Exact historical book choices
retain their existing behaviour; non-book fallback must never use Classic's book.

## Verification and strength

Tests must exercise actual choices, complete-depth safety, timeout fallback, both colours, seed
identity, terminal positions and original v1/v2/v3 behaviour. Include unique mate/free-queen fixtures,
poisoned captures/recaptures, pinned attackers, and multi-move sequences that demonstrate development,
opening lines and attacking coordination. Freeze representative positions before implementing their
policy expectations; do not select tests merely because the finished policy happens to pass them.
Retain a full-policy diagnostic report with actual chosen moves, plan progress, completed depth,
neutral loss and fallback counts; compare Classic descriptively, not as a disagreement quota.
Historical move matching is optional descriptive evidence, not the acceptance target for a hand-designed
Morphy-inspired opponent. Testable plan progress and tactical guards are the new engineering checks;
perceived human style remains something the owner can judge and must not be falsely certified.

Add calibration protocol morphy-plans-paired-v1, exact version4/plans-v1 identity. Use production
chooseOpponentMove, START, colour-swapped seeds, actual settings, max1000plies, no adjudication. Retain
50/100/200-pair checkpoints, z2.4 interval width<=300, finite estimate/no unresolved games and nearest25
rounding. Freeze all influencing playing/harness files first. Do not reuse v3 measurements. Existing
protocols/evidence stay available. Measure before exposing v4 in normal setup: existing validators
reject beta records once an identical config becomes rated, so no durable user beta-v4 transition is
introduced. Engine/worker tests can use disposable synthetic state until accepted fixed ratings exist.

## Actual-app integration and compatibility

After measurement, new setup defaults to v4 when the existing personality flag is enabled; users still
see one Paul Morphy option. Preserve explicit versions1/2/3 for rematches and show the earlier-version
notice for saved v3 games too. Describe current policy as documented openings plus designed development
and attacking plans; do not claim all off-book choices were learned from Morphy or historically played.
Add independently measured v4 values; keep all old receipts/ratings immutable and hints/takebacks unrated.

Advance authoritative local keys to guest state-v5, account-v5, guest-history-v4. Read all previous
recovery generations in order; corrupt current authority must block fallback. Preserve pending account
snapshots/base versions/history ordering/ownership. Wire schema remains2. Current client header becomes
X-Chess-Rating-Policy:3, and server minimum_policy rises permanently to3 after accepting v4, including
assisted games. Allow only supported literal headers1/2/3, reject older clients after the floor rises,
preserve the floor through Classic/reset/restart, and preserve exact original wire acknowledgements.

## Delivery

Implement in the existing app, with no separate prototype, new top-level opponent or unrelated UI.
Preserve permanent dark default, Home/Resume/forfeit, elapsed clocks, offline explicit updates,
original185 openings/27 cards, human games and private accounts. No live player data in tests.
Run full tests/source checks, enabled/default builds, real browser game/rematch/save/account/offline
checks and accessibility. Independent task and final reviews precede source push/deployment to the
existing hostname under standing authorization. Use a consistent private backup and compatible update;
never force an active game reload. No paid service, Stockfish or additional release tag requested.
