# Task 1: direct Morphy plans — 12 September 2026 BDT

Implemented the actual version4/plans-v1 engine and calibration harness on codex/morphy-plans,
based on1f03de7. Version4 is supported only as an unrated synthetic configuration in this
checkpoint. Current setup remains version3; rating tables, persistence/server policy and earlier
version bodies are unchanged. No strength calibration, app release, push or deployment was run.

## Runtime API and decisions

- `plannedMorphyConfig(seed)` returns exact attack-development/version4/plans-v1 with the existing
  seeded-per-ply-v1 identity. Normal `chooseOpponentMove` dispatch routes only this exact supported
  identity to `choosePlannedMove`. The public `AiResult` and worker request shape are unchanged.
- `searchRootCandidates(position,maxDepth,ms,now?,absoluteDeadline?)` returns `{candidates,depth,
  fallback,timedOut}`. Candidate scores are mover-relative, fallback score is White-relative.
  The optional sixth argument is an approved interface addendum: `min(start+ms,absoluteDeadline)`
  prevents setup latency from extending the outer deadline. Ordinary five-argument use is unchanged.
- `morphyPlan(position)` returns `{mode,target}`. `planFeatures(position,side)` exposes legal home-minor,
  king-area, bishop/rook access and useful rook-file counts. `planProgress(position,legalMove)` returns
  `{terms,bonus}` for the current goal; its move argument must be legal in the given position.
- `explainPlannedMove(position,level,seed,ply,now?)` is the full production decision, returning
  `{result,plan,progress,depth,neutralLoss,searchTimedOut,reason}`. `choosePlannedMove` returns its
  `result` without a second search. Reasons are book/terminal/mate/plan/neutral/incomplete/deadline.
  `progress:null` means no plan ranking was published. `neutralLoss:0` on a fallback means no styled
  departure was applied; depth0 does not claim a fully searched safety estimate.

Every legal root gets a separate full-window neutral search at each depth, with a fresh
transposition table. An incomplete iteration is discarded in full. Mate scores bypass plans.
Only moves within100cp of the best complete score are eligible; positive weighted progress is
clamped to240cp. All conditions and coefficients are retained in behaviour-protocol.md.

A30ms reserve stays inside Casual200ms/Club600ms/Strong2000ms. An incomplete deeper search may
still rank the previous complete roots. An expired ranking discards all progress and returns the
complete neutral fallback. No background plan state or additional time budget was introduced.

The frozen legal documented book is selected by an independent exact copy of version3's hash,
occurrence counts, filtering and strict `<0` selection convention. It never calls version3's
learned off-book evaluator or substitutes Classic's book. Old source bodies and book/model bytes
were preserved; the old dispatch acquired only the explicit version4 branch.

## Test-first evidence and design corrections

Initial RED: four missing root-candidate API tests; nine missing plan/config APIs. A missing-module
scaffold was supplied before rerunning the latter to actual failing API calls. Focused implementation
then exposed two incorrect chess assumptions, retained transparently in the protocol:

1. The original centre fixture had Be6 attacking Bc4. d4 loses325cp against the best complete score;
   its rejection is now a tactical regression. Moving that bishop back to c8 makes the proposed
   break viable at90cp neutral loss. Initial70cp break priority still lost to preparatory Qe2.
   Controller approved150cp to implement the intended immediate-break preference before any
   measurement. The guard remains100cp, maximum bonus240cp. No coefficient sweep was performed.
2. The original Ne2 pin fixture was too far from Kg8 to test attacking participation; Rh1 genuinely
   reached h7. The additional Kg4 fixture gives the pinned knight actual pseudo-access to the king
   area. The legal feature count excludes that knight and retains the rook.

The hypothetical post-check board regression failed with two counted squares instead of one:
board.ts can enumerate capturing the enemy king when turn is flipped for feature analysis.
Plans-v1 now filters these impossible captures without modifying board.ts or earlier engines.
The absolute-deadline test failed with completed depth1 despite an expired outer deadline; the
new optional cap correctly returns depth0 without publishing alternatives.

Calibration RED: plans protocol initially rejected as unsupported. GREEN covers exact v4 identity,
START, wrong versions/openings, legal saved-game replay, worker resume without overwriting results,
and changed new-policy fingerprints. Legacy and historical protocol mappings remain tested.
Fingerprint coverage now includes the new runtime policy, diagnostic harness and frozen behaviour
protocol alongside the existing engine/book/harness files.

## Measured diagnostics

Final source: behaviour.json and behaviour-report.md; the earlier run remains in
behaviour.pre-final.json and behaviour-report.pre-final.md with its original fingerprints.
Final fingerprints were independently verified against the working tree after generation.
Machine: Apple M5 Pro, arm64 macOS, Node22.23.0,15 reported logical CPUs. No calibration games were run.

| Production level | Both-colour positions | Plan applied | Ranking/incomplete fallback | Deeper search timeout | Maximum neutral loss | Maximum elapsed |
|---|---:|---:|---:|---:|---:|---:|
| Casual |22|10|0|0|0cp|27.7ms|
| Club |22|10|0|0|90cp|108.9ms|
| Strong |22|10|0|10|70cp|1971.3ms|

Each level also had ten neutral decisions and two immediate mates. All reported elapsed values
include production selection. Strong retained complete roots and applied plans even after deeper
search timeout. This small fixture set is timing evidence on this Mac, not a device-wide guarantee.

Actual fixed-depth Club sequences, with rank-reflected colour counterparts retained in JSON:

- Development: Nf3 ...a6 Nc3 ...d6 Bc4. Each move develops a new minor; bonuses110cp each,
  neutral losses0/0/20cp. Classic chose Nc3/Nc3/d4 in those corresponding positions.
- Centre: d4 ...exd4 Nxd4. First move has140cp progress and90cp neutral loss; the recapture
  retains open-centre mode and is the complete neutral choice. Classic chose Bd5 then Nxd4.
- Coordination: Bxe6 ...fxe6 Ng5. The first and next moves add a king-area participant;
  bonuses88/96cp, neutral losses0/10cp. Classic chose Bxe6 then Nb5.

The original coordination fixture has no Black queen and is materially uneven; a balanced
coordination position was also frozen and evaluated in the66 real-clock decisions. Classic
comparisons differed14/4/8 times at Casual/Club/Strong. These are descriptive observations, not
an acceptance quota; Casual also has unchanged noise, while the new policy has complete roots.

## Commands and verification

Every Node shell used `source ~/.nvm/nvm.sh && nvm use >/dev/null` (Node22.23.0).

- `npm test -- tests/engine/root-candidates.test.ts tests/engine/morphy-plans.test.ts tests/calibration/matches.test.ts`:34/34 passed before the final three boundary regressions.
- `npm test -- tests/engine tests/game/opponents.test.ts tests/game/rated-morphy.test.ts tests/calibration/matches.test.ts`:142/142 passed across12 files,8.89s. This includes original opening corpus/model, earlier Morphy, neutral review and rating compatibility tests.
- `npm run typecheck`: passed after explicit diagnostic-array and test-options type annotations.
- `npm run lint`: passed, zero warnings.
- `npm run format:check`: passed. Formatting changed no existing engine body beyond the explicit v4 dispatch.
- `node --import tsx scripts/calibration/plans-behaviour.ts`: retained66 production-timed decisions
  plus14 fixed-depth trace decisions and their Classic comparisons.
- `assertExactSourceFingerprints` against final behaviour.json: passed.
- `git diff --numstat 1f03de7` for historical-morphy.ts, historical-features.ts, morphy-model.json,
  morphy-book.json, eval.ts, board.ts and rating/fide.ts: no changes.

Local source/report checkpoint uses `feat(engine): add explicit Morphy playing plans`. Its hash is
recorded in the ignored task ledger report and controller handoff. The .superpowers report is not
published. No unrelated project files were edited and no subagents were spawned for this task.

## Limits and next task

This demonstrates explicit position-derived plan progress and bounded neutral-score departures.
It does not certify perceived Morphy style, historical off-book fidelity, tactical infallibility,
playing strength or physical-device performance. Goals are recomputed from the board, not remembered.
The neutral100cp guard is this engine's estimate at the last completed depth. The weighted plan may
reduce playing strength; fresh complete-game measurement is required before normal v4 setup.

Task2 should independently review this checkpoint, freeze it, then use
`morphy-plans-paired-v1` with exact version4, START, production settings, colour-swapped pairs,
max1000plies/no adjudication and the predeclared50/100/200-pair checkpoints. No measured v3 rating
may be reused. Task3 owns measured eligibility, setup and storage/account compatibility; actual-app,
full-suite/build/browser/accessibility and deployment checks remain with the controller.
