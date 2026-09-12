# Direct Morphy plans strength measurement — 12 September 2026 BDT

The exact reviewed source at `d8c376dd7613fa53e72e6850462f68e7b60cc877` was frozen before play.
This run measured attack-development version 4 / `plans-v1` against production Classic at the same
difficulty. The accepted fixed Practice Ratings are **Casual 1225, Club 1400 and Strong 1625**.

## Frozen protocol

The predeclared protocol was `morphy-plans-paired-v1`: every pair began from the normal START position
with no forced opening, then played two complete games with Morphy's color swapped. Pair seed `n` was
`(0x20260912 + n * 7919) >>> 0`. Both players used the production settings for the selected level.
Games ended only by legal chess rules; there was no evaluation adjudication or resignation. A game
still active after 1,000 plies would be unresolved and make the checkpoint ineligible.

Classic anchors were the app's existing 900 / 1350 / 1800 values. The declared checkpoints were
50 / 100 / 200 pairs. The interval used the existing approximate pair-Wilson calculation with z=2.4.
Eligibility required a declared checkpoint, no unresolved games, a finite estimate within 0–10000,
and interval width at most 300. An eligible estimate was rounded to the nearest 25 for app use.

The run used Node 22.23.0 on an Apple M5 Pro Mac with 15 reported logical CPUs. Eight pair workers ran
within one level at a time; levels ran sequentially. The overall freeze, install, measurement and audit
procedure ran from 21:24:22 to 21:52:12 BDT. Exact machine, production-setting and source identities are
retained in the [public evidence bundle](calibration-20260912/README.md).

## Checkpoints and accepted values

| Level | Pairs / games | Morphy wins / draws / losses | Estimate | Approximate interval | Width | Eligible | Fixed value |
|---|---:|---:|---:|---:|---:|---|---:|
| Casual | 50 / 100 | 78 / 12 / 10 | 1188.0637213623827 | 1032.4841334887471–1343.6433092360182 | 311.1591757472711 | No | — |
| Casual | 100 / 200 | 159 / 26 / 15 | 1215.348166226132 | 1097.4677432029443–1333.2285892493194 | 235.76084604637504 | Yes | 1225 |
| Club | 50 / 100 | 19 / 78 / 3 | 1406.0714812660146 | 1288.8457671371752–1523.2971953948543 | 234.45142825767903 | Yes | 1400 |
| Strong | 50 / 100 | 5 / 41 / 54 | 1613.753563074265 | 1481.680952669355–1745.826173479175 | 264.1452208098199 | Yes | 1625 |

Casual extended only after its 50-pair interval exceeded the 300-point limit. It stopped at its first
eligible checkpoint of 100 pairs. Club and Strong stopped at their first eligible 50-pair checkpoints.
No 200-pair extension was needed. All 400 games reached terminal chess outcomes; none was unresolved.

Terminal reasons were: Casual 174 checkmates and 26 threefold repetitions; Club 22 checkmates and
78 threefold repetitions; Strong 59 checkmates and 41 threefold repetitions. Recorded ply ranges were
18–177, 41–169 and 37–172 respectively. Summed per-game elapsed fields were 109176.86904499998 ms,
339439.1007929999 ms and 8490363.286244003 ms. Those captured timings overlap because eight workers
ran concurrently and are retained as execution evidence, not as a device performance claim.

## Resolved commands

Every game command used the explicit binary
`/Users/adnanrashid/.nvm/versions/node/v22.23.0/bin/node` from the frozen source directory. For each
level, initialization and verification used:

```sh
$MORPHY_NODE_BIN --import tsx scripts/calibration/run.ts LEVEL "$RUN_DIR" PAIRS 1000 morphy-plans-paired-v1 --init-only --concurrency=8
seq FIRST LAST | xargs -P8 -I{} "$MORPHY_NODE_BIN" --import tsx scripts/calibration/worker.ts LEVEL "$RUN_DIR" {} morphy-plans-paired-v1
$MORPHY_NODE_BIN --import tsx scripts/calibration/run.ts LEVEL "$RUN_DIR" PAIRS 1000 morphy-plans-paired-v1 --verify-only --concurrency=8
```

Casual used 0–49 / 50 pairs, then 50–99 / 100 pairs. Club and Strong each used 0–49 / 50 pairs.
Locked dependencies were installed with npm 10.9.8 under Node 22.23.0 before initialization.

## Verification and limits

The frozen harness verify-only pass legally replayed every saved match. A separate audit then replayed
all 400 SAN histories from START, recomputed repetition and every legal terminal condition, and matched
every final FEN, score and result reason. It verified both colors and the exact seed for all 200 pairs,
recalculated all four observed checkpoints independently, matched the retained full-precision JSON,
and reproduced nearest-25 values 1225 / 1400 / 1625.

The audit also matched every uncompressed raw-game hash to its deterministic compressed JSONL line,
confirmed 400 lines with no omissions, and rehashed all 279 frozen source files after measurement.
The source tree still matched the pre-run inventory; the frozen git archive hash is
`2c9ebc486e53bce67369b259fe83db7f95025cb991acd3881e43b11bfa72c909`.

The exact local evidence remains at
`/Users/adnanrashid/Downloads/chess-prodigy-morphy-plans-20260912/evidence`; the frozen source tree is
at `/Users/adnanrashid/Downloads/chess-prodigy-morphy-plans-20260912/frozen-source`. The retained source
archive is `frozen-source-d8c376dd7613fa53e72e6850462f68e7b60cc877.tar.gz`. The raw evidence/log
archive is `evidence-raw-d8c376d.tar.gz`, SHA-256
`a63cf14baabbb2d9037a42ed0e20bb3df756a31ef27d72990026ca56bc213121`.

These are internal Practice Ratings relative to Chess Prodigy's Classic anchors. They do not certify
human or FIDE strength, perceived Morphy style, historical resemblance, tactical perfection, other
hardware, or strength after any playing-policy change. Versions 1–3 and their measurements are not
repriced by this run. Any change to version 4's playing policy or an influencing frozen source requires
a new version and fresh complete-game measurement.
