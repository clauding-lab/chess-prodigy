# Fischer frozen measurement — 19 September 2026 BDT

Frozen playing commit `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`; archive SHA256 `d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9`. Complete 417-file inventory, original game JSON and contemporaneous logs are retained at `/Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c/`. Node 22.23.0 on macOS arm64, eight concurrent pair workers. All games began at START, used production level limits, 1000-ply bound, paired seeds/colors and no adjudication.

| Level | First eligible checkpoint | W–D–L | Unresolved | Raw rating | Bounds | Independent nearest-25 rating |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual | 100 pairs | 163–28–9 | 0 | 1254.498 | 1126.711–1382.285 | 1250 |
| Club | 50 pairs | 21–60–19 | 0 | 1356.950 | 1241.158–1472.741 | 1350 |
| Strong | 50 pairs | 3–60–37 | 0 | 1676.976 | 1554.156–1799.795 | 1675 |

The 50-pair Casual interval was 1088.590–1455.917 (width 367.327), so only that level extended to 100 pairs. Club and Strong stopped at 50. `calibration/` retains the exact manifests and both Casual summaries, a 400-game compressed JSONL pack, original-file/line hash map and SHA256SUMS. Pack SHA256: `cec2347b2e797d2582903f2bf0b7edd4b61fb71e7a76f19fc2843927b4caf7bc`. The separate independent legal/source/statistical audit accepted all three values; see `independent-calibration-review.md` for its checks and limits. These are internal Practice Ratings, not human/FIDE strength or perceived historical style.
