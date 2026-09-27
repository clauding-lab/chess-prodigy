# E0 benchmark foundation — 27 September 2026 BDT

This is a reproducible **development baseline foundation**, not completion of the engine improvement programme. No playing source, opponent configuration, receipt or rating changed. No complete-game strength tournament, candidate tuning, blind owner comparison, physical-phone measurement or release occurred.

## Frozen data and exposure

`e0-dataset-v1/manifest.json` pins all engine/book/rating source files, original corpus hashes, canonical whole-game IDs, partition hashes and the split seed. Eighty unique historical games are selected by the ascending SHA-256 of their complete SAN move list before any engine evaluation. The existing importers legally replay each entire game. The SHA-256 of `e0-20260927-whole-games-v1:<game ID>`, modulo five, assigns one fifth to validation. Source IDs and roster color do not create separate copies of the same game.

Every position in each selected game participates in leakage checking, even if it is not sampled. Every canonical position key appearing in both partitions is quarantined from both; within-partition repeats are retained once. Keys ignore halfmove/fullmove counters but retain side, castling and legally relevant en passant. Sampling starts at ply 12 and selects plies congruent to 0 or 1 modulo 12, retaining both colors. A ply is one player's move. This yielded 743 development positions, 160 validation positions and 52 quarantined cross-partition keys from 80 source games.

The validation file is generated and hashed, but no benchmark runner reads its contents. `run.ts` can only execute development data. Keep validation untouched during candidate tuning; use a separately reviewed validation execution path only after candidate freeze. These historical games previously informed the published repertoires. The partition is untouched by **new tuning**, not unseen historical training evidence. The old ignored scratch probe is neither imported nor relabeled as independent validation.

`curated-v1.json` freezes five independently authored development fixtures. Tests verify legal quiet choices, sole check defense, an immediate mating conversion, a pawn ending and a poisoned pawn with a legal queen recapture. These properties do not certify engine strength or sacrifice compensation. Independently adjudicated compensated sacrifices, wider defensive positions, opening-deviation coverage, and positive/negative multi-move plan sequences remain to be added before candidate acceptance.

## Reproduction

From the repository root, select the pinned Node version:

```sh
source ~/.nvm/nvm.sh
nvm use
npx vitest run tests/engine/personality/benchmark.test.ts
npx eslint scripts/engine-bench --max-warnings=0
npx tsc -p tsconfig.server.json
node --import tsx scripts/engine-bench/freeze.ts /tmp/e0-fresh-dataset
node --import tsx scripts/engine-bench/run.ts /tmp/e0-fresh-dataset /tmp/e0-fixed fixed-completed-policy 1 offbook
node --import tsx scripts/engine-bench/run.ts /tmp/e0-fresh-dataset /tmp/e0-timed production-elapsed 1 offbook
```

Use new directories: freeze and execution refuse to replace artifacts. The last number is samples **per color**, not games. `all` keeps repertoire positions; `offbook` selects positions absent from every current repertoire and Classic's legal opening continuation list, without looking at decision scores. Engines still run their untouched real book/policy paths. The first eligible position per color in canonical game order forms the bounded smoke cohort; increase the predeclared count for broader development coverage. Stop files without `summary.json` are incomplete and cannot qualify as aggregate results.

Each position runs all six current configurations, all three levels and independent seeds 317/9029. Validation seeds 19471/78157 are reserved. Classic's ambient randomness is supplied by the existing injectable seeded generator for repeatability; this is a harness control, not a new runtime Classic identity. Historical policies retain their actual per-ply seed semantics. Future reports must keep legacy Morphy versions in separate cohorts.

## What the two modes mean

`fixed-completed-policy` uses a constant nonexpiring clock, allowing the existing configured search to finish (Casual/Club/Strong configured depths 1/2/4; Classic Casual retains its quiescence/noise policy). This compares completed **policy decisions**, not equal node counts or equal processing work. Mate exits and documented choices remain possible. It is not a hardware timing simulation. There are no fake node counts inferred from clock calls. Strong can take longer than the production budget.

`production-elapsed` supplies real `performance.now()` with untouched 200/600/2000 ms budgets, including personality ranking allowances. It measures direct warm Node calls; worker startup and real-phone behavior are unmeasured. Root tests and other benchmark processes must be idle for an isolated timed run.

The explanation APIs expose completed depth/selected plan for the five historical opponents and timeout for Morphy/Chigorin. Classic's public move API hides depth/timeout; roster explanations hide timeout; all hide visited-node counts. These unsupported fields remain null. A null timeout is not zero. The frozen source is checked before a run and exact script hashes are retained in new run manifests.

## Four separate scorecards

Strength is explicitly `not-measured`: move agreement and depth do not establish winning strength. Tactical results are labeled a shallow proxy from completed depth-2 root alternatives in the same neutral engine, not an independent deeper adjudicator. Variety counts seed-dependent changes. Personality reports pairwise agreement and observed selected-plan metadata; coherent multi-move plans and owner perception are unmeasured.

Before results, genuine-choice classification was fixed as at least two fully analyzed alternatives within 30 centipawns at completed neutral depth 2, excluding mate-range scores. One centipawn is one hundredth of a pawn in the evaluation. A sole legal move is `forced-legal`; one credible shallow choice is `single-credible`; incomplete or mate-range comparisons are `uncertain`. Only genuine-choice cells enter the secondary agreement rate. This is a narrow shallow-equivalence proxy, not a proven safety certificate. It is not changed to obtain lower agreement.

Aggregation keeps sample, level, seed and clock mode separate, rejects duplicate or incomplete six-opponent cells, and reports exact pair denominators. The bounded run contains two positions, not 180 independent observations: pair comparisons and seeds are correlated. No statistical confidence or population personality claim follows. Register wider game-level sampling, deeper independent loss thresholds, match protocol and uncertainty method before tuning/acceptance.

## Retained runs

- `e0-production-smoke-v1`: initial all-position integration smoke, 72 decisions. The runner had not yet recorded its own source hashes. Retained as exploratory setup evidence only.
- `e0-fixed-offbook-v1`: 72 completed-policy decisions across two off-book positions. The exact runner text is retained as `harness-run.ts.txt`: it had a duplicate identical `cohort` property, corrected after process start. The duplicate did not alter JavaScript behavior; the archived source explains the hash difference. Its timing overlapped another process and is not performance evidence.
- `e0-production-offbook-v1`: 72 elapsed-time decisions concurrent with the fixed run. **Contended exploratory evidence; not an accepted timing baseline.**

All are retained without overwriting. The two-position smoke results must not set final improvement thresholds. E0's broader corpus/coverage, repeated full games and sequences, independent loss review, anonymous actual-app owner comparison and physical-phone evidence remain open gates.
- `e0-production-offbook-isolated-v1`: sequential 72-decision elapsed-time run after the fixed process exited and the root agent paused CPU-heavy commands. Node v22.23.0, Apple M5 Pro, arm64. This is the retained bounded local timing baseline; it is not actual-phone or browser-worker evidence.

The off-book fixed run yielded 61 agreeing pairs / 180 comparisons (33.89%); the isolated timed run yielded 45 / 180 (25.00%). Both sampled positions satisfy the predeclared shallow genuine-choice proxy. These are **two-position smoke figures**, not representative roster agreement rates and not comparable to the old 68–82% probe. Their purpose is to prove that the harness separates modes, uses all current identities, and retains genuine decision/plan data. No target was fitted from them. Completed historical depths and actual reason/timeout fields remain in each immutable cell.

## Predeclared 12-position development broadening

After independent foundation review, the next bounded sample was declared in `e0-development12-preregistration-v1.json` **before the broader outcomes**: the existing first six eligible off-book positions per color, four source-game clusters, all six current opponents, three levels and seeds 317/9029. No harness or selection algorithm changed. The two earlier off-book smoke positions are included, so this is expanded development evidence, not fresh validation. Source-game clusters contain 4, 2, 3 and 3 positions, respectively; their complete IDs are retained in the preregistration and every decision cell.

`e0-development12-fixed-v1` completed 432 decisions before `e0-development12-production-isolated-v1` began its 432 decisions. The root agent and review agent confirmed heavy commands idle before the timed run and resumed after its process exited. Node v22.23.0, Apple M5 Pro, arm64. All 864 selected moves passed the runner's legal-move check. Every predeclared outcome is retained; no outcome-driven extension or retry occurred.

| Descriptive scorecard | Completed-policy mode | Isolated production mode |
| --- | --- | --- |
| Strength | Not measured | Not measured |
| Tactical reliability | Same-engine depth-2 proxy; maximum observed loss 460 cp | Same proxy; maximum observed loss 460 cp |
| Seed variety, changed position/level cells out of 36 | Classic 10; Morphy 1; Chigorin 0; Spassky 0; Tal 0; Fischer 2 | Classic 10; Morphy 1; Chigorin 0; Spassky 0; Tal 0; Fischer 3 |
| Full pairwise agreement | 633/1080 = 58.61% | 605/1080 = 56.02% |
| Genuine-choice agreement | 258/540 = 47.78% | 222/540 = 41.11% |

Six positions satisfy the preregistered shallow genuine-choice proxy; six have only one credible move under that proxy. None is a sole-legal-move position. The authored forced-defense fixture remains separately tested. These are 12 positions from **four unevenly sized source-game clusters**, not 1080 independent observations. Pooled rates give larger clusters more weight. They demonstrate the retained baseline's sampled behavior, not improved strength, tactical soundness, perceived personality, historical authenticity or a population estimate. No confidence interval or improvement target is fitted to them.

The production historical explanations reported Strong depth 3 in 14/24 decisions per opponent and depth 4 in 10/24. Morphy and Chigorin each exposed 14 timed-out deeper searches among 72 total decisions, with an earlier complete result retained. The other four opponents do not expose comparable timeout telemetry; unknown status is never a zero-timeout claim. There were zero `incomplete` reason results among the 360 historical decisions that expose that status; Classic status remains unknown. This direct warm Node run still does not measure browser startup or physical phones.

`e0-development12-integrity-and-clusters-v1.json` retains each source game's exact agreement denominator, available telemetry, separate scorecards, summary hashes and an audit showing all 36 frozen playing/book/rating files unchanged. It rechecks 432 cells per mode, exact preregistered sample IDs, complete summaries and aggregation equality. Validation positions were not read and no candidate was tuned.

Reproduce the broadened decision runs with new output directories, sequentially:

```sh
node --import tsx scripts/engine-bench/run.ts docs/verification/engine-improvement/e0-dataset-v1 /tmp/e0-development12-fixed fixed-completed-policy 6 offbook
node --import tsx scripts/engine-bench/run.ts docs/verification/engine-improvement/e0-dataset-v1 /tmp/e0-development12-timed production-elapsed 6 offbook
```

Keep other heavy commands idle during the second command. The same sample IDs and completed-work decisions are reproducible; elapsed-time decisions can vary with machine scheduling. Full acceptance gaps listed above remain open.
