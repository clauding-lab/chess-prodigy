# Morphy historical corpus provenance

Generated on 12 September 2026 BDT from Jack Goossens's collection linked by
[Tim Krabbé](https://timkr.home.xs4all.nl/ChessTutor/morphy.htm). The committed JSON copies
game facts and brief metadata only. Source commentary and variations are not retained.

| Role | Archive / PGN | Archive SHA-256 | PGN SHA-256 |
|---|---|---|---|
| Primary corpus and repertoire | `morphy.zip` / `MORPHY.PGN` | `c35a99b6588f3e9bf5b04abe2b85faf86039cb3b5fcb85f79bb5b7d769ff55f7` | `85ffdb07d93cf8fd666c2bc953f37bee47d2a7bc3031b9948c4ff2f37ee884d6` |
| Serious-game holdout | `pmorphy.zip` / `PMORPHY.PGN` | `ee2ae384a175b6fd78b9bdca1b011b3980a4bf1231184877a42e2e15591ca98f` | `655fc94a94b92dc3b9a03b1e038443c3aa3341bbf639a6818824c2bba3591bdb` |

The importer starts every record from the normal initial position and resolves every token against
Chess Prodigy's legal moves. It converts accepted moves to SAN, rejects the whole record on any
illegal or unsupported move, rejects every `SetUp`/`FEN` record and explicitly labelled odds game,
and accepts Paul only where one player name is exactly `Morphy`. That last rule excludes four
consultation/team records such as `Morphy/Mongredien`; it does not confuse Paul with Alonzo Morphy.
Exact duplicates are identified by the SHA-256 of Morphy's colour plus the normalized move sequence.

## Generated facts

- Primary source parse: 415 records; 248 legally accepted before cross-source conflict review.
- Primary exclusions: 157 setup/FEN records, 5 explicitly labelled odds games, 4 records without the
  exact player name `Morphy`, and 1 illegal record. No exact duplicate remained after normalization.
- Final corpus after conflict review: 247 games and 16,186 legally replayed plies.
- Repertoire: 8,144 documented Morphy turns across 6,940 positions and 7,020 distinct continuations.
  The initial position contains only `e2e4` with count 152, derived from Morphy's own White games.
- Serious source parse: 59 records; 58 legally accepted and 1 illegal. After conflict review, 57 clean
  whole-game IDs match the primary corpus and are listed in `holdoutIds`.

Primary record 40 and serious record 12 contain the same malformed Paulsen–Morphy score. After a
106-ply SAN score terminated with `*`, the source appends a second rendering of its final moves;
`Bc1-e3` is illegal at parser ply 107. Both entire records are excluded.

One otherwise legal serious-collection game conflicts with the primary corpus: Morphy–Löwenthal,
London match, 1858, serious record 20, ID
`3813d62f1c7e5e8f82a8695a7bf700ee9bc43fc10c252aebcfbcac0e976ffb1f`. Its final move at ply 55 is
`Nb1`; metadata-matched primary record 154, ID
`a30d96004519fcc3650d295ba4d8dfaa98833ad746b973febafe16d3b015e574` has `Kb1`. The importer records
that mismatch and excludes both legal variants from the final corpus, repertoire and clean holdout.
It does not guess which source's final move is historically correct and neither variant can enter
model training.

## Reproduction and validation

Place the two fingerprinted ZIP files in `/tmp/chess-morphy-history/`, then run:

```sh
source ~/.nvm/nvm.sh
nvm use
node --import tsx scripts/morphy-history/import.ts
npm test -- tests/engine/historical-corpus.test.ts
```

The generated `morphy-games.json` retains every exclusion with its source record index and exact
reason, source counts and hashes, unmatched holdout metadata, the accepted games and matched holdout
IDs. `morphy-book.json` is the runtime `posKey` to `[UCI move, count]` map. The focused test legally
replays the committed corpus and checks every stored continuation against the keyed position.

## Complete-game strength measurement

The frozen version-3 policy was measured against Classic from the normal initial position on
12 September 2026 BDT. The [measurement report](measurement-report.md) records the fixed protocol,
checkpoint decisions, internal-scale estimates and limits. Its [public evidence bundle](calibration-20260912/README.md)
contains manifests, full-precision summaries, aggregate checks and all 400 synthetic SAN game records.
