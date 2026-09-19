# Chigorin measurement evidence

The frozen source is `adfc0060635fc5d4ee7dc8103dac3722c732408c`. The games completed on
13 September 2026 BDT; the independent audit resumed on 19 September 2026 BDT.

- `games.jsonl.gz` retains all 400 synthetic complete games, ordered by source filename.
- `match-map.json` maps each line to its raw filename, original SHA-256 fingerprint, normalized
  JSONL-line fingerprint, pair, color and seed. Raw files have different whitespace from JSONL.
- The three manifests bind opponent identity, production settings, source and machine conditions.
- Checkpoint summaries retain Casual's ineligible 50-pair result and eligible 100-pair result,
  plus Club and Strong at 50 pairs each. No eligible level was rerun.
- `frozen-source.json` contains the 331-file source inventory; `frozen-archive.sha256` identifies
  the retained original archive.

The full source archive, unchanged frozen tree, raw games and worker/verification logs remain in
`/Users/adnanrashid/Downloads/chess-prodigy-chigorin-20260913/`.
No live player data appears in these records. These measurements concern internal Practice Ratings;
they do not establish human strength or perceived historical style.
