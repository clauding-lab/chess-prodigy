# Independent Tal calibration review — 19 September 2026 BDT

**Accepted for rated integration:** `tal/version1/tal-plans-v1` fixed Practice Ratings **Casual 1200 / Club 1325 / Strong 1700**. Casual stopped at its first eligible 100-pair checkpoint; Club and Strong stopped at 50. This review does not activate ratings or cover changed playing policies.

| Level / pairs | Games | W / D / L | Estimate | Interval | Width | Decision |
| --- | ---: | --- | ---: | --- | ---: | --- |
| Casual / 50 | 100 | 78 / 16 / 6 | 1215.348166 | 1051.557809–1379.138524 | 327.580715 | Continue |
| Casual / 100 | 200 | 152 / 36 / 12 | 1201.331067 | 1086.662496–1315.999638 | 229.337142 | Accept 1200 |
| Club / 50 | 100 | 12 / 69 / 19 | 1325.639668 | 1209.595788–1441.683549 | 232.087761 | Accept 1325 |
| Strong / 50 | 100 | 5 / 60 / 35 | 1692.461875 | 1571.314333–1813.609417 | 242.295085 | Accept 1700 |

All **400 games / 31,395 plies** replayed from START, with zero unresolved games: 235 checkmates, 160 threefold repetitions, two fifty-move-rule draws and three insufficient-material draws. Exact expected contiguous pair/color/seed files, legal SAN, terminal priority, final FEN, player-relative scores and aggregate timing bounds passed. All manifests, retained checkpoints/final summaries, per-pair logs and every intermediate verification-log summary match independent calculations. Casual's original ineligible 50-pair checkpoint was preserved; only pairs 50–99 were added. No eligible level was extended.

## Coincident Club tally investigation

Tal and Spassky both scored 12 wins / 69 draws / 19 losses at Club, so the independent audit explicitly compared their 100 matching-seed/color games. **None of the 100 move histories matched**, and no complete Tal Club history matched any Spassky Club history. Only 52 corresponding game outcomes matched; 48 differed. Every Tal protocol/id/engine field is `tal`/`tal-plans-v1`, distinct from Spassky. Per-game raw hashes, first differing plies and outcome comparisons are retained in `club-identity-comparison.json`.

Inspected the source routing covered by the frozen fingerprints: `scripts/calibration/match.ts` derives the roster identity from the declared protocol and passes it through `chooseRosterOpponentMove`; the Node dispatcher routes `id === "tal"` to `chooseTalMove`. That function uses Tal's own book and `talPolicy`. This supports the declared routing and distinct evidence under the trusted-local execution boundary; it is not a claim that labels alone establish engine origin. No evidence of copied histories or wrong-player routing was found.

## Source, pack and provenance

The unchanged, separately code-reviewed independent audit `calibration-audit.ts` imports no calibration estimator, runner or saved-match verifier. Statistics use the approved approximate pair-count Wilson z=2.4 bounds/width ceiling 300, with independent nearest-25 rounding. It shares frozen production board legality/SAN/insufficient-material; terminal/repetition logic is independently reconstructed. Self-tests passed again during this full execution. Its standalone strict TypeScript and separate code review were already accepted.

All **417** archived/inventoried/extracted files matched the pinned commit, with exact path sets, regular archive file/directory types, no unexpected extracted paths/symlinks outside node_modules, transitive local import coverage in the exact manifest set, and a second source-byte check after replay. Machine manifests bind Node v22.23.0, macOS arm64, Apple M5 Pro, 15 logical CPUs and eight pair workers.

Independently decompressed and checked all 400 packed records against original raw games: sorted source names, unique sequential lines, deep equality, canonical JSON and raw/canonical-line hashes (line hashes include trailing newline). Copied manifests, all four checkpoint summaries and source inventory/archive fingerprint files are byte-identical to originals. `shasum -a 256 -c SHA256SUMS` passed; source-fingerprint copies were separately compared with `cmp`.

Reviewed the contemporaneous execution ledger and unchanged eight-worker scheduler. Schedule/per-pair logs agree with first-eligible stopping: Casual 50 verified 20:07:50 BDT, Casual 100 at 20:08:14 BDT, Club at 20:09:06 BDT, Strong at 20:23:39 BDT. Original files remain under `/Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c/{tal,logs}`.

The separately executing runner's contemporary local account and logs are the provenance trust boundary; this auditor did not launch or directly observe its engine processes. Hashes and legal replay do not cryptographically attest timed-engine origin, and elapsed-time search decisions were not regenerated. Installed node_modules bytes are not independently attested. Ratings are relative to frozen Classic anchors and establish neither human/FIDE strength nor perceived historical style. No blocking discrepancy was found; no strength game was rerun.

## Fingerprints and reproduction

- Frozen commit: `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`.
- Archive SHA-256: `d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9`.
- Inventory SHA-256: `7d84045a58c536be23eaaf4f110cee7b2db404c69c10a224b45c1cf63a12f44d`.
- `independent-audit.json`: `db8949dfa2114f7158455dbd20fb37ae2b3178dde327635e6ff0f21cc17aded2`.
- `club-identity-comparison.json`: `4cc436957fba9d37c32e958ad215a29891db62a0f270d27079330dadfe1c28cd`.
- `calibration/games.jsonl.gz`: `1fd98ab44c9169bb2f4a5b6ae7c435fd7e6d4bdf8b658aea7e8c68afcc0f9740`.
- `calibration/match-map.json`: `15a469827ae8bb6ec67cb73ee4d5327b78d86ad14f067c4404b9ffd2c2f6fb9e`.

Use a new output path:

```sh
source /Users/adnanrashid/.nvm/nvm.sh && nvm use --silent
node --import tsx docs/verification/roster/calibration-audit.ts \
  /Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c \
  tal /tmp/tal-independent-audit-new.json \
  --pack docs/verification/roster/tal/calibration
```

Retained full execution exited 0 with 400 games, `eligibleForRatedIntegration: true` and a verified non-null pack. Fischer remains a separate pending audit decision.
