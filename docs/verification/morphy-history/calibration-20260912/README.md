# Historical Morphy measurement evidence

This public bundle records the complete-game `historical-v1` measurement run on 12 September 2026 BDT.
See the [measurement report](../measurement-report.md) for the fixed protocol, results and limits.

## Contents

- `casual-manifest.json`, `club-manifest.json`, `strong-manifest.json`: exact protocol, opponent and
  Classic identities, production search limits, machine conditions, concurrency and all 27 frozen
  source/data/model/tool fingerprints.
- `casual-50-summary.json`: the ineligible first Casual checkpoint retained before extension.
- `casual-100-summary.json`, `club-50-summary.json`, `strong-50-summary.json`: accepted checkpoint
  calculations with full-precision estimates and intervals.
- `raw-aggregate.json`: counts, terminal reasons, timing totals, ply ranges and identity checks
  recomputed from the saved games.
- `games.jsonl.gz`: all 400 raw synthetic games, sorted by level/pair/colour. Each JSON line retains the
  seed, colour, empty opening, SAN history, final FEN, terminal reason, score and timings.
- `SHA256SUMS`: hashes for every file in this directory other than the checksum list itself.

Inspect the raw records with:

```sh
gzip -dc games.jsonl.gz | jq -c . | less
```

The frozen source archive, downloaded historical ZIP/PGN files and full local execution logs are
deliberately not included here. They remain in the local evidence parent described in the measurement
report. No live player data appears in this bundle.
