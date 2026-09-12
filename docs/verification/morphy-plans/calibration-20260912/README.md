# Direct Morphy plans measurement evidence

This public bundle records the complete-game `plans-v1` measurement run on 12 September 2026 BDT.
See the [measurement report](../measurement-report.md) for the protocol, results and limits.

## Contents

- `source-identity.json` and `frozen-source.sha256`: reviewed commit, execution environment, archive
  identity and hashes for all 279 frozen source files.
- `casual-manifest.json`, `club-manifest.json`, `strong-manifest.json`: exact opponent and Classic
  identities, production search settings, machine conditions, concurrency and influencing-source hashes.
- `casual-50-summary.json`: the retained ineligible first Casual checkpoint.
- `casual-100-summary.json`, `club-50-summary.json`, `strong-50-summary.json`: accepted checkpoint
  calculations at full precision.
- `independent-audit.json`: independently replayed game inventory, terminal-reason counts, ply/timing
  totals, interval recalculations and nearest-25 results.
- `match-map.json`: deterministic JSONL line-to-source mapping, including the original raw-file hash,
  pair, color and seed for every game.
- `games.jsonl.gz`: all 400 raw synthetic games in lexicographic level/pair/color order. Each line keeps
  the seed, color, empty opening, SAN history, final FEN, terminal reason, score and captured timings.
- `SHA256SUMS`: hashes for every other file in this directory.

Inspect the records with:

```sh
gzip -dc games.jsonl.gz | jq -c . | less
```

The uncompressed raw games, full worker/verification logs, exact frozen source tree and frozen source
archive remain in the local Downloads evidence path named in the report. No live player data appears
in this bundle.
