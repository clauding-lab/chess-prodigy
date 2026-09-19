# Independent Fischer calibration review — 19 September 2026 BDT

**Accepted for rated integration:** `fischer/version1/fischer-plans-v1` fixed Practice Ratings **Casual 1250 / Club 1350 / Strong 1675**. Casual stopped at its first eligible 100-pair checkpoint; Club and Strong stopped at 50. Acceptance applies only to the frozen policy and does not itself activate ratings.

| Level / pairs | Games | W / D / L | Estimate | Interval | Width | Decision |
| --- | ---: | --- | ---: | --- | ---: | --- |
| Casual / 50 | 100 | 82 / 15 / 3 | 1272.253494 | 1088.590105–1455.916884 | 367.326780 | Continue |
| Casual / 100 | 200 | 163 / 28 / 9 | 1254.498172 | 1126.711060–1382.285284 | 255.574224 | Accept 1250 |
| Club / 50 | 100 | 21 / 60 / 19 | 1356.949638 | 1241.157977–1472.741300 | 231.583324 | Accept 1350 |
| Strong / 50 | 100 | 3 / 60 / 37 | 1676.975655 | 1554.155881–1799.795429 | 245.639547 | Accept 1675 |

All **400 games / 32,400 plies** replayed from START with zero unresolved games: 252 checkmates, 145 threefold repetitions and three fifty-move-rule draws. Exact pair/color/seed sets, Fischer identity, legal SAN, terminal priority, final FEN, player-relative scores and aggregate timing bounds passed. Every manifest, preserved checkpoint/final summary, worker log and intermediate verification-log summary agrees with independent computations. The ineligible 50-pair Casual result was retained; only pairs 50–99 were subsequently added. No eligible level was extended.

## Independent method and source

The independently code-reviewed `calibration-audit.ts` imports no calibration estimator, runner or saved-match verifier. It derives the approved approximate pair-count Wilson bounds with z=2.4, maximum width 300 and independent nearest-25 rounding. Frozen production board legality, SAN conversion and insufficient-material detection are shared; terminal priority and legal-en-passant repetition counting are separately reconstructed. Negative self-tests passed during this execution; the standalone strict TypeScript check and separate audit-code review were already accepted. No strength game was rerun.

Verified all **417** archived/inventoried/extracted source files, exact paths, regular archive file/directory types and no unexpected extracted paths/symlinks outside node_modules. The exact manifest file set covers the Node worker's transitive local imports. Frozen source bytes were checked again after legal replay. Manifest environment: Node v22.23.0, macOS arm64, Apple M5 Pro, 15 logical CPUs, eight pair workers.

## Pack and trusted execution provenance

Independently decompressed all 400 packed records and checked exact sorted source names, unique sequential line numbers, deep record equality, canonical JSON and both raw-source and canonical-line hashes against originals. Canonical-line hashes include the trailing newline. Three copied manifests, all four checkpoint summaries and both source fingerprint files are byte-identical to external originals. `shasum -a 256 -c SHA256SUMS` passed every listed artifact; source fingerprints were separately checked with `cmp`.

Reviewed the contemporaneous execution ledger, unchanged scheduler and timestamped logs. Casual 50 verified at 20:24:20 BDT, Casual 100 at 20:25:00 BDT, Club at 20:25:53 BDT and Strong at 20:43:19 BDT on 19 September. The scheduler runs the frozen checkout with eight pair workers, verifies the exact checkpoint and preserves its summary; every required worker log records successful completion of both color games. No source, identity, stopping or result discrepancy was found.

Original artifacts remain under `/Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c/{fischer,logs}`. Provenance relies on the separate runner's contemporaneous local execution account and logs, not cryptographic attestation. This auditor did not launch or directly observe those processes. Legal replay and hashes do not prove the engine generated the recorded moves, and elapsed-time-dependent search choices were not regenerated. Installed node_modules contents are not independently attested. Fixed Practice Ratings are relative to Classic anchors; they are not human/FIDE ratings or evidence of perceived historical style.

## Fingerprints and reproduction

- Frozen commit: `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`.
- Archive SHA-256: `d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9`.
- Inventory SHA-256: `7d84045a58c536be23eaaf4f110cee7b2db404c69c10a224b45c1cf63a12f44d`.
- `independent-audit.json`: `3720b66159b4c622fcf73e7b1cff4166d835b294b06bde07f898750d93f4195b`.
- `calibration/games.jsonl.gz`: `cec2347b2e797d2582903f2bf0b7edd4b61fb71e7a76f19fc2843927b4caf7bc`.
- `calibration/match-map.json`: `c4254ce9b040bb17e0eb92fe412e08bb8d08ac6ae2a4975ebfe22c1362b7b405`.

Use a new output path:

```sh
source /Users/adnanrashid/.nvm/nvm.sh && nvm use --silent
node --import tsx docs/verification/roster/calibration-audit.ts \
  /Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c \
  fischer /tmp/fischer-independent-audit-new.json \
  --pack docs/verification/roster/fischer/calibration
```

Retained full audit exited 0 with 400 games, `eligibleForRatedIntegration: true` and a verified non-null pack. With the separately accepted Spassky and Tal evidence, all nine levels have now been independently audited: **1,100 games / 87,731 plies**, with no unresolved games. Each player's acceptance remains bound to its own identity and measured values.
