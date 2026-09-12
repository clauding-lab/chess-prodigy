# Historical Morphy policy and preference fit — 12 September 2026 BDT

Task 2 selects the first fixed `historical-v1` model after a modest improvement in held-out static move prediction. Version 3 is supported but remains unrated pending the separate complete-game strength measurement. No deployment or rating change is part of this checkpoint.

## Runtime policy

`historicalMorphyConfig(seed)` identifies attack-development version 3, historical-v1, seeded-per-ply-v1. Versions 1 and 2 retain style-v1 and their existing factories. The only legacy engine change is dispatch to the new policy for supported version 3.

Terminal positions, the fifty-move bound and insufficient material are checked first. At a matching `posKey`, only stored legal UCI moves qualify; exact occurrence counts determine seeded selection. This applies at every difficulty, including Casual. A recorded continuation takes precedence over a separately discoverable mate. Classic's supplied repertoire cannot influence this branch. The runtime imports only the compact historical book and fitted model, never the full game corpus.

Away from recorded positions, existing custom search uses the production difficulty depth/time limits and `evaluate(position) + historicalStyle(position)`. Scores retain White's perspective. Historical style is a clipped dot product, limited to ±250 centipawns; ordinary material values remain intact.

## Features and fixed fitting protocol

Each feature is calculated for White and Black independently, normalized and saturated at one per side, then differenced. Search leaves use board-local geometry and attack queries, without generating legal move trees for features.

| Feature                  | Per-side normalizer / definition                         | Fitted pawn weight |
| ------------------------ | -------------------------------------------------------- | -----------------: |
| Development              | Minor pieces off their home rank / 4                     |       0.3977798061 |
| Bishop mobility          | Unobstructed nonfriendly destinations / 26               |       0.3285700211 |
| Rook files               | Semi-open files count 1, open files count 2 per rook / 4 |       0.4637790862 |
| Central presence         | Own pieces on d4, e4, d5, e5 / 4                         |       0.2369815928 |
| King-ring pressure       | Attacked valid neighboring enemy-king squares / 8        |       0.4785824974 |
| Castling placement       | King on c/g of its home rank                             |       0.7305212066 |
| Connected rooks          | Any unobstructed same-rank/file pair                     |       0.2272421606 |
| Checks                   | Enemy king attacked                                      |      -0.0799213516 |
| Premature queen exposure | Advanced queens × own home-rank minor pieces / 4         |      -0.2710873530 |
| Knight activity          | Nonfriendly knight destinations / 16                     |       0.2831924180 |

These are position proxies: castling placement does not establish actual move history, and mobility ignores pins. The negative check coefficient is a fitted residual preference after neutral capture quality, not a rule to avoid forcing tactics.

The protocol was fixed before the first fit: at most eight evenly spaced eligible Morphy turns per game, zero-based ply >=8, at least two legal moves. With n eligible turns and k=min(8,n), choose indexes floor(i×(n−1)/(k−1)); when k=1 choose index zero. All 57 matched serious games are excluded in their entirety from the 190-game training partition. Changing held-out labels or adding held-out positions cannot change fitted weights.

Each legal successor receives neutral quality `-quiesce(next,-MATE,MATE,2,0,nodeClock)/100`, in the original mover's perspective. A candidate exceeding 10,000 deterministic clock callbacks excludes its entire sample, with no replacement. The callback returns Infinity at callback 10,001 to trigger the engine's private timeout; unrelated errors propagate. The cap path is behaviorally tested, although no actual corpus sample reached it (maximum candidate callbacks: 63).

Training starts with ten zeros and performs exactly 200 full-batch steps at learning rate 0.15. L2 is 0.01, with regularizer 0.5×L2×sum(weight²), individual weights bounded to [-2,2], and the same ±2.5-pawn net clipping used at runtime. Stable maximum-shifted softmax handles mate-extreme scores. The gradient is zero through saturated style terms and retains the L2 derivative.

## First-fit results — book disabled

The fixed model was accepted without protocol, feature, weight, or holdout tuning. There were 1,972 sampled positions and zero exclusions.

| Partition               | Positions | Historical top choice | Legacy top choice | Historical log loss | Legacy log loss |
| ----------------------- | --------: | --------------------: | ----------------: | ------------------: | --------------: |
| Training, 190 games     |     1,516 |          459 (30.28%) |      438 (28.89%) |        2.6050246390 |    2.6535176518 |
| Final holdout, 57 games |       456 |          140 (30.70%) |      135 (29.61%) |        2.5676879243 |    2.6033478610 |

Lower log loss is better. Both comparisons use exactly the same neutral capture quality; the baseline adds the legacy static `morphyStyle` preference. Both break equal top scores by the first legal move. Full precision weights, scores, protocol, game IDs, sample identities, node counts, exclusions and source fingerprints are retained in [training.json](training.json).

Whole-game separation prevents direct use of held-out games during fitting, but shared opening positions and repeated opponents remain correlated. The runtime book includes held-out games. Accordingly, these book-disabled measurements assess only the static preference model, not an independent end-to-end playing policy or human strength. No perfect reconstruction of Morphy is claimed.

## Reproduction and verification

Run with Node 22.23.0 (the repository `.nvmrc` selection):

```sh
source ~/.nvm/nvm.sh && nvm use >/dev/null
node --import tsx scripts/morphy-history/train.ts
```

The first-fit artifact was retained locally before testability/type-only changes. Subsequent full generation runs produced a byte-identical model and identical weights, metrics, scored-sample digest and sample identities. Only provenance hashes for edited training/runtime source changed. The final generation records the final source hashes. No model/protocol tuning occurred between runs.

- Model SHA-256: `bcac472c15613f704ec1069c2089951312321a6f43ff2e33f0c50d69621cefc3`.
- Scored-sample SHA-256: `8adf92f3872f11f943fb536a44e9fd0eb02d9a10b21a93c4741094ee803d7e67`.
- Corpus SHA-256: `77a770ddbc030b2684521624284ca36eb5afee7dc239beb44bc20561cd766a07`.
- Book SHA-256: `c5230029b96e9a56198d160e03dadee61e7a91d65f77af8b429823ee47049e94`.

Checks:

- Focused legacy and historical engine tests: 27/27 passing; latest historical-only rerun: 11/11 passing.
- Full suite: 375/375 tests, 43/43 files passing. Expected Better Auth invalid-password warnings are emitted by existing negative account tests.
- Repository typecheck, lint and format checks pass. The generated JSON tuple inference issue found by initial typecheck was resolved with the actual inferred array shape and explicit entry type guards; no runtime unchecked cast is required.
- Canonical TypeScript, lint and formatting commands now cover all `scripts/morphy-history` tools. ESLint also ignores the local `.superpowers` scratch directory, allowing the broad repository lint gate to run. Direct strict TypeScript checks cover the historical test; direct tool/report Prettier checks pass. This tooling coverage was moved forward from Task 5 to complete the Task 2 review gate.
- Review-gate follow-up: `npm run typecheck`, `npm run lint`, `npm run format:check` and `npx eslint . --ext .ts,.tsx,.js,.jsx` all pass. Covering corpus and historical-policy tests pass 26/26. The only tool-source adjustment replaces DOS EOF-marker removal with equivalent `replaceAll(String.fromCharCode(26), "")` to satisfy the newly applied lint rule. Generated corpus, book and fitted model bytes remain unchanged.
- Budget smoke used this off-book position: `r1bq1rk1/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PPQ2PPP/R1B2RK1 w - - 4 9`. Seed 123, ply 16. Deterministic clock callbacks and separate real elapsed measurements: Casual 150 callbacks / 3.126 ms; Club 602 / 24.189 ms; Strong 1,370 / 323.256 ms. All choices legal and off book. Production budgets remain 200/600/2,000 ms; these local timings are smoke evidence, not strength or physical-device evidence.

The policy/data/model are ready for the separate review gate and frozen complete-game calibration. Version 3 must not become rated based on these prediction metrics.
