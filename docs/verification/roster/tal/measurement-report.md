# Tal frozen measurement — 19 September 2026 BDT

Frozen playing commit `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`; archive SHA256 `d9696798ab7f0032d0c9b0b347a848c4b34cd3c83d27bc4f92c478a35d5caca9`. Complete 417-file inventory, original game JSON and contemporaneous logs are retained at `/Users/adnanrashid/Downloads/chess-prodigy-roster-20260919-9a7ab6c/`. Node 22.23.0 on macOS arm64, eight concurrent pair workers. All games began at START, used production level limits, 1000-ply bound, paired seeds/colors and no adjudication.

| Level | First eligible checkpoint | W–D–L | Unresolved | Raw rating | Bounds | Independent nearest-25 rating |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual | 100 pairs | 152–36–12 | 0 | 1201.331 | 1086.662–1316.000 | 1200 |
| Club | 50 pairs | 12–69–19 | 0 | 1325.640 | 1209.596–1441.684 | 1325 |
| Strong | 50 pairs | 5–60–35 | 0 | 1692.462 | 1571.314–1813.609 | 1700 |

The 50-pair Casual interval was 1051.558–1379.139 (width 327.581), so only that level extended to 100 pairs. Club and Strong stopped at 50. `calibration/` retains the exact manifests and both Casual summaries, a 400-game compressed JSONL pack, original-file/line hash map and SHA256SUMS. Pack SHA256: `1fd98ab44c9169bb2f4a5b6ae7c435fd7e6d4bdf8b658aea7e8c68afcc0f9740`. The independent legal/source/statistical audit and its limits are in `independent-calibration-review.md`; it also checked that Tal and Spassky Club's identical aggregate counts came from distinct games. These are internal Practice Ratings, not human/FIDE strength or perceived historical style.
