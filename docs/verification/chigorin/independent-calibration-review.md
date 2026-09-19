# Independent Chigorin calibration review — 19 September 2026 BDT

**Decision: accepted for rated integration.** The completed frozen measurement qualifies at every declared stopping point: Casual **1250**, Club **1350**, Strong **1625**. These are fixed Practice Ratings for `chigorin/version1/chigorin-plans-v1`; they are not human/FIDE ratings. This review does not activate ratings, publish or deploy the application.

## Evidence and independent method

Reviewed the approved Chigorin design, frozen protocol, estimator, match implementation and saved-match verifier, plus the separate audit implementation retained as `calibration-audit.ts`. Executed that audit under Node **v22.23.0**, tsx **4.23.13**, against `/Users/adnanrashid/Downloads/chess-prodigy-chigorin-20260913`. No new strength games were played and no frozen files were changed.

The audit imports no calibration runner, estimator or verifier. It independently derives the declared pair-count Wilson bounds (z=2.4), converts scores to ratings against Classic anchors 900/1350/1800, rounds eligible values to the nearest 25, reconstructs terminal outcomes and legal-en-passant repetition keys, and compares every saved summary/log record. It shares the frozen production board's legal move generation, SAN conversion and insufficient-material predicate; this is independent measurement verification, not a second independently implemented chess rules engine.

Verified the source archive's SHA-256 and embedded Git commit, all **331** archive/inventory/extracted-file contents, complete path sets, no unexpected extracted files or symlinks outside `node_modules`, and unchanged frozen source again after replay. Every manifest matches the declared opponent, seeds, START opening, production limits, no adjudication, 1000-ply bound and recorded machine/environment. The recorded eight-worker configuration is checked; individual worker scheduling cannot be reconstructed from match JSON.

Replayed all **400 complete games**, **31,107 plies**, from START. Checked exact expected pair/color file sets, every legal SAN move, no moves after termination, final FEN, outcome reason and Chigorin-relative score. No unresolved games, missing pairs, extra pairs or early unresolved terminations were found. Every worker-log entry and all intermediate verification-log summaries match. Aggregate timings are finite, nonnegative and no greater in sum than total game elapsed time.

The audit's self-checks pass for symmetric/bounded estimates, unresolved rejection, legal mate/repetition, rejection of tampered scores/FEN/seeds/post-terminal moves/timing, and legal versus pinned en passant.

## Checkpoints

| Level/checkpoint | Games | Wins / draws / losses | Raw estimate | Interval | Width | Decision |
| --- | ---: | --- | ---: | --- | ---: | --- |
| Casual, 50 pairs | 100 | 76 / 19 / 5 | 1208.239245 | 1046.668977–1369.809513 | 323.140537 | Continue: width exceeds 300 |
| Casual, 100 pairs | 200 | 160 / 30 / 10 | 1238.039216 | 1114.587785–1361.490647 | 246.902861 | Accept 1250 |
| Club, 50 pairs | 100 | 19 / 65 / 16 | 1360.426196 | 1244.606591–1476.245801 | 231.639210 | Accept 1350 |
| Strong, 50 pairs | 100 | 2 / 51 / 47 | 1631.597875 | 1502.537500–1760.658250 | 258.120750 | Accept 1625 |

All three stopped at their first eligible checkpoint. The 200-pair extension was unnecessary. Terminal reasons total 254 checkmates, 144 threefold repetitions, one stalemate and one insufficient-material draw.

## Reproduction and fingerprints

From the Chigorin worktree, use a new output filename because the audit intentionally refuses to overwrite evidence:

```sh
/Users/adnanrashid/.nvm/versions/node/v22.23.0/bin/node --import tsx \
  docs/verification/chigorin/calibration-audit.ts \
  /Users/adnanrashid/Downloads/chess-prodigy-chigorin-20260913 \
  /tmp/chigorin-independent-audit-new.json
```

- Frozen commit: `adfc0060635fc5d4ee7dc8103dac3722c732408c`.
- Frozen archive SHA-256: `ac4f96ddd183bb7316f1ee29627274ae2908304c8a85a2dea66cb5b666dac50c`.
- Frozen inventory SHA-256: `d2424006ebe714c3ef744edfabdce4b69cc5bbe556b3b030e9748e936b41ed68`.
- Audit implementation SHA-256: `e9c188b597de0b0afc664a3e14fa98661d24bfb8d0e7137ba56c774923fe06b4`.
- Retained output `independent-audit-20260919.json` SHA-256: `1a419881ed32b0d3813fef0c3c71f16260b8c74ba1e7ada4f9ab66524d05f4cc`.

The retained JSON includes each game's and each checked log's SHA-256. Evidence packing and release integration are separate follow-up work.

## Limits and concerns

No blocking discrepancy was found. The approved interval is an approximate pair-count Wilson calculation, not proof of a human rating or a guarantee of statistical coverage for all correlated engine play. The 144 repetition draws are retained as actual terminal outcomes, without adjudication. Legal replay verifies saved games and outcomes; it does not regenerate elapsed-time-dependent search choices or establish perceived Chigorin style. Per-move timing and observed worker concurrency were not stored. Acceptance applies only to the frozen playing policy and source; changed playing behavior requires fresh measurement.

## Retained evidence pack acceptance

Independently decompressed `calibration-20260913/games.jsonl.gz` and verified all **400** records against the original raw match files and the audit's game hashes. The map contains the exact lexicographically sorted 400-file set with unique sequential line numbers. Every decompressed line is exactly `JSON.stringify` of its original parsed game; each parsed record is deeply equal to the original. Original raw-file SHA-256 values and separate JSON-line SHA-256 values (excluding the newline) all match `match-map.json`; mapped pair, color and seed match too. Copied manifests, checkpoint summaries, frozen inventory and archive fingerprint file are byte-identical to the run originals.

- `games.jsonl.gz` SHA-256: `fde631a0735e75fb9e5e670e96ea8be1da7892caf11dc2f832880a8381f0a5c8`.
- `match-map.json` SHA-256: `d6fc61995f3c8abf670798c1ae2d8771634b71fc584f2de0989986779474f42e`.

The pack preserves all game data with canonical JSON line formatting; it does not preserve original raw-file whitespace. Its raw-source hashes remain verifiable against the retained run originals. The pack is accepted without discrepancies. Full source-archive and worker/verification-log checks above were performed against the external frozen run, not reconstructed solely from this smaller repository pack.

## Execution provenance assessment

Legal replay and source hashes alone **do not prove that the frozen engine generated the saved moves**: fabricated but internally consistent legal games could satisfy those checks. Acceptance also relies on trusted local execution provenance recorded in `/Users/adnanrashid/.Codex/session-data/2026-09-13-chigorin-calibration-session.tmp`, together with the retained worker and verification logs checked above. That contemporaneous session records the exact frozen commit/archive, Node executable, worker command, eight-worker scheduling, observed Casual/Club checkpoints, and the still-running Strong job (97 of 100 completed matches at 00:28:31 BDT on 13 September). It records the existing Strong worker-to-verifier command chain and explicitly prohibits duplicate workers or remeasurement of eligible levels. Its reported Casual/Club counts and estimates agree with the independently audited final files. The later completed Strong files and logs are internally consistent with that recorded unfinished run.

This reviewer did not personally observe the original process launch; the saved execution account and local artifacts are the trust boundary, not cryptographic attestation. No positive evidence of fabrication, source substitution, mismatched identities or altered outcomes was found in the reviewed evidence. The review concern correctly identifies a limit of replay, but it does not identify a discrepancy in this run. The approved protocol requires frozen production complete-game measurement and independent verification, not independent reconstruction of every timed search decision or signed execution attestation. Re-running wall-clock searches would be a new measurement and may produce different moves through different completed search depths; it cannot establish the exact origin of earlier moves. Therefore this limitation is explicit and does not change acceptance under the approved protocol and recorded trusted local execution.

## Standalone audit TypeScript check

The normal repository typecheck does not include `docs/`. This explicit strict check of the retained audit passed with exit status 0 on 19 September 2026 BDT (no files emitted):

```sh
/Users/adnanrashid/.nvm/versions/node/v22.23.0/bin/node \
  node_modules/typescript/bin/tsc \
  --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution Bundler --types node --skipLibCheck \
  --esModuleInterop --resolveJsonModule \
  docs/verification/chigorin/calibration-audit.ts
```
