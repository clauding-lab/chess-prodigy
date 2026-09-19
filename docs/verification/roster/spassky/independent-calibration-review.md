# Independent Spassky calibration review — 19 September 2026 BDT

**Accepted for rated integration:** `spassky/version1/spassky-plans-v1` fixed Practice Ratings **Casual 1150 / Club 1325 / Strong 1700**. Every level stopped at its first eligible 50-pair checkpoint. This acceptance does not itself activate ratings or authorize a different playing policy.

| Level | Games | W / D / L | Estimate | Interval | Width | Fixed rating |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| Casual | 100 | 73 / 17 / 10 | 1157.594352 | 1010.207930–1304.980775 | 294.772845 | 1150 |
| Club | 100 | 12 / 69 / 19 | 1325.639668 | 1209.595788–1441.683549 | 232.087761 | 1325 |
| Strong | 100 | 6 / 61 / 33 | 1703.807656 | 1583.739751–1823.875561 | 240.135810 | 1700 |

All **300 games / 23,936 plies** replayed from START with zero unresolved games: 153 checkmates and 147 threefold repetitions. Exact pair/color/seed sets, legal SAN, terminal priority, final FEN and opponent-relative scores passed. No post-terminal moves or timing inconsistencies were found. All manifests, retained checkpoint summaries, live final summaries, per-pair logs and every intermediate verifier-log summary matched independent calculations. The approximate pair-count Wilson interval uses z=2.4 and the approved width ceiling of 300; ratings are separately rounded to the nearest 25. Casual's width remains below that unchanged ceiling.

The independent script imports no calibration estimator, runner or saved-match verifier. It shares frozen board legality, SAN and insufficient-material detection, while reconstructing terminal/repetition checks independently. Its standalone strict TypeScript check and negative self-tests passed; separate code review of commit `1e224a7` approved the implementation. No strength game was rerun.

## Frozen source and retained pack

- Commit: `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`.
- Archive SHA-256: `d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9`.
- Inventory SHA-256: `7d84045a58c536be23eaaf4f110cee7b2db404c69c10a224b45c1cf63a12f44d`.
- Audit implementation SHA-256: `3a33e25fe5959eefbee36237303a3e7b35eb3c16baf38cdc48cc3548aa600c06`.
- Independent output `independent-audit.json` SHA-256: `5f7b361668d4c2eab2613a12da137037ade351176f30c32c6ac0101d97505a87`.
- `calibration/games.jsonl.gz` SHA-256: `3dc5e05c3206ae070e46fff7ba5468ea731e424ad3d27c733119c1ad3079cdb8`.
- `calibration/match-map.json` SHA-256: `bddaf6017207c6c8d3537cb917f6e636e6d3131789c052ff2a39f3944f578552`.

Verified all 417 archive/inventory/extracted source files, exact paths, regular file/directory archive entries and no unexpected extracted paths or symlinks outside node_modules. The Node worker's transitive local imports are covered by the exact manifest source set. Frozen source bytes were checked again after replay. The manifest records Node v22.23.0, macOS arm64, Apple M5 Pro, 15 logical CPUs and eight pair workers. Locked package definitions are pinned; installed node_modules bytes are not independently attested.

Independently decompressed all 300 packed records and compared exact sorted source names, sequential line numbers, deep record equality and canonical JSON against raw originals. Original raw-byte hashes and canonical-line hashes **including the trailing newline** match the map. All three copied manifests/checkpoint summaries and both source fingerprint files are byte-identical to external originals. `shasum -a 256 -c SHA256SUMS` passed for every listed artifact; the inventory/archive fingerprint copies were checked separately with `cmp`.

## Execution provenance and limits

Original source, matches and logs remain at `/Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c`. Reviewed the contemporaneous Task 3 execution ledger and `run-stage.sh`, SHA-256 `c806740442004e4f6f44228c080d15fc95b9425247094e82721ef49b82f889eb`. The scheduler changes into the frozen checkout, selects Node with nvm, runs only missing pair IDs via `xargs -P 8`, then verifies the exact checkpoint and preserves its summary. Timestamped worker logs record successful start/end and both colors. Schedule records and the runner's live messages agree: Casual completed 19:50:09 BDT, Club 19:51:29 BDT, Strong 20:07:05 BDT; no eligible level was extended.

This auditor did not launch or directly observe those engine processes. Provenance relies on the separately executing runner's contemporaneous local account and retained logs; legal replay and hashes alone cannot prove that a timed engine generated a move history. No inconsistent source, identity, result or checkpoint evidence was found. No deterministic replay of elapsed-time-dependent choices or cryptographic engine attestation is claimed. Practice Ratings measure performance against the fixed Classic anchors, not human/FIDE strength or perceived historical style.

## Reproduction

Use a new output path because evidence overwrite is refused:

```sh
source /Users/adnanrashid/.nvm/nvm.sh && nvm use --silent
node --import tsx docs/verification/roster/calibration-audit.ts \
  /Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c \
  spassky /tmp/spassky-independent-audit-new.json \
  --pack docs/verification/roster/spassky/calibration
```

The retained execution completed with exit status 0, `totalGames: 300`, `eligibleForRatedIntegration: true`, and a non-null verified pack. Acceptance applies to this player only; Tal and Fischer remain separate audit decisions.
