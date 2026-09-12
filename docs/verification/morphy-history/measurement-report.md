# Historical Morphy complete-game measurement — 12 September 2026 BDT

Status: measurement complete and independently audited. Exact version-3 Practice Ratings 1275 / 1375 /
1775 are accepted for the compatibility and rated-play implementation. No version-3 rating, UI,
storage or server policy changed in this measurement task.

## Frozen protocol and conditions

The approved `morphy-historical-paired-v1` harness at commit `5428825` measured
attack-development version 3 / `historical-v1` against Classic version 1 at the same app difficulty.
Every game began at the normal initial position with `opening: []`; no six-ply opening was injected.
The historical opponent therefore used its actual 6,940-position recorded book when a documented
position matched, followed by its production historical search policy. Classic retained its own
production book and search with the harness's reproducible seeded match stream.

At each level, one seed produced a colour-swapped pair. Both engines used the production level
settings recorded in the manifests: Casual depth 1 / 200 ms, Club depth 2 / 600 ms and Strong depth 4 /
2,000 ms. There was no evaluation adjudication or resignation. Only legal checkmate, stalemate,
threefold repetition, the fifty-move rule or insufficient material could finish a game. Reaching the
1,000-ply bound would preserve an unresolved `null` score and make the checkpoint ineligible.

The first checkpoint was 50 pairs. Only the predeclared 100- and 200-pair checkpoints could follow.
Eligibility required at least 100 games, no unresolved result, a finite estimate and an approximate
pair-Wilson interval no wider than 300 points. The interval uses z=2.4 for the three planned looks and
the existing Classic anchors 900 / 1,350 / 1,800. Accepted point estimates are rounded to the nearest
25 for the next implementation task.

The source was frozen at
`/Users/adnanrashid/Downloads/chess-prodigy-historical-morphy-20260912/frozen-source`. Its local source
archive is `source-5428825.tar.gz`, SHA-256
`88cc72363acb3b574b1e8e722819b4030be53c538becd088b774fb3955702ed4`. The run used Node 22.23.0 on an
Apple M5 Pro, Darwin 25.6.0 arm64, with 15 logical CPUs and `xargs -P 8` as the configured maximum pair
worker concurrency. The fitted model remained
`bcac472c15613f704ec1069c2089951312321a6f43ff2e33f0c50d69621cefc3`; the historical book remained
`c5230029b96e9a56198d160e03dadee61e7a91d65f77af8b429823ee47049e94`.

An initial manifest-only preflight at 15:35:58 BDT exposed Node 26.3.1 from the surrounding shell. No
game had started. That rejected zero-game init was preserved locally, a fresh evidence directory was
created, and every accepted command used the explicit Node 22.23.0 binary. All accepted manifests record
22.23.0 and passed final source-fingerprint verification.

## Checkpoint results

| Level | Pairs / games | Morphy W-D-L | Draw rate | Estimate | Approximate interval | Width | Decision | Rounded candidate |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Casual, first look | 50 / 100 | 86-11-3 | 11% | 1312.80 | 1112.64–1512.96 | 400.33 | Extend to 100 pairs | — |
| Casual, accepted | 100 / 200 | 165-26-9 | 13% | 1263.20 | 1133.02–1393.38 | 260.36 | Eligible; stop | 1275 |
| Club, accepted | 50 / 100 | 33-43-24 | 43% | 1381.35 | 1265.13–1497.58 | 232.45 | Eligible; stop | 1375 |
| Strong, accepted | 50 / 100 | 15-60-25 | 60% | 1765.14 | 1648.81–1881.47 | 232.66 | Eligible; stop | 1775 |

The measured run contains 400 games and 200 colour-swapped pairs. No game was unresolved. Casual ended
174 times by checkmate, 25 by repetition and once by the fifty-move rule. Club ended 57 times by
checkmate and 43 by repetition. Strong ended 40 times by checkmate and 60 by repetition. No outcome was
edited, dropped or adjudicated.

The raw audit independently aggregates the persisted JSON as 200 Casual, 100 Club and 100 Strong games;
it finds only protocol `morphy-historical-paired-v1`, opponent version 3 / `historical-v1`, opening
length zero and maximum bound 1,000. Every game with Morphy as White begins `e4`, the only recorded
initial-position Morphy move in the historical book. The frozen harness then legally replayed the full
SAN history and recomputed the final FEN, terminal reason and score in `--verify-only` mode at every
reported checkpoint.

## Timing and retained evidence

Wall time under the configured maximum concurrency of eight was about 5.55 seconds for Casual's two
batches, 11.56 seconds for Club and 451.10 seconds for Strong. Summed per-game elapsed time was 27.83
seconds, 79.81 seconds and 3,445.20 seconds respectively. Strong games averaged 34.45 seconds and ranged
from 15.34 to 79.56 seconds. These figures describe this concurrent run; CPU contention can change how
much iterative search finishes inside a wall-clock budget.

The exact retained launch commands use `xargs -P 8`, every manifest declares concurrency 8, and worker
records are interleaved in the logs. No separate continuous process-count trace was captured, so this
evidence establishes the configured maximum and launch method rather than proving that eight workers
were simultaneously active at every moment.

The committed [evidence bundle](calibration-20260912/README.md) contains all three manifests, every
checkpoint summary, the raw aggregate audit and all 400 synthetic SAN game records in deterministic
compressed JSON Lines form. Full uncompressed game JSON, worker output, hardware/source checks,
checkpoint audit logs and per-game SHA-256 hashes remain under
`/Users/adnanrashid/Downloads/chess-prodigy-historical-morphy-20260912/evidence`. Historical source ZIPs,
raw PGN and the frozen source archive remain local and are not published in this evidence bundle.

## Interpretation limits

These values measure relative performance on Chess Prodigy's internal scale. The Classic anchors are
not calibrated to people, so these are not FIDE ratings or human-strength estimates. The interval
covers match sampling under these fixed seeds and conditions; it does not include uncertainty in the
anchors, hardware, search time lost to concurrent-worker contention, alternate game samples or future
code.
Colour-swapped games within a pair are related observations, and the approximate interval treats the
pair mean as the sampling unit.

The historical book includes the documented collection used to derive the policy. A move prediction
fit and this engine-vs-engine result do not establish a perfect reconstruction of Paul Morphy, nor do
they prove how he would play unseen modern positions. High Club and Strong draw rates further limit
precision.

## Independent acceptance

An independent read-only audit on 12 September 2026 BDT replayed all 400 games under Node 22.23.0,
checked every pair/colour/seed/opponent identity and legal result, and recomputed all four retained
checkpoints and rounding decisions. All 27 source fingerprints match the frozen files, archive and
commit `5428825`. All 400 worker records and per-game hashes match; the committed compressed game
collection reproduces the sorted raw JSON byte for byte, and all ten bundle checksums pass.

The audit accepted Casual 1275, Club 1375 and Strong 1775 only for attack-development version 3 /
historical-v1 with this model and policy. It found no blocking issue and confirmed the disclosed
concurrency-observation and rejected zero-game initialization limits. Earlier opponent versions and
their values remain unchanged.
