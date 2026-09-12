# Chigorin corpus — 12–13 September 2026 BDT

The approved direct PGN URL returned HTTP404. The [official PGN Mentor catalog](https://www.pgnmentor.com/files.html)
links [Chigorin.zip](https://www.pgnmentor.com/players/Chigorin.zip), containing Chigorin.pgn.
Both exact originals are retained here. No Morphy import source, old book or old policy was changed.

- Archive SHA256: `a0f2d72830ae1b94bb16e5ea293f5347f6ec6f56080fdaa80ac246918c4c43df`
- PGN SHA256: `2417f6cd5cc94ec88a07b529c0b610ac9b06de5673db0f72d56670f4a2b166d0`
- Exact accepted player identity: `Chigorin, Mikhail`, on exactly one side.
- Initial legal import:688 ordinary games;351 White and337 Black; zero exclusions.
- 26,262 distinct canonical positions and30,101 Chigorin-turn continuation occurrences.

The importer rejects odds/setup/FEN/variant/consultation records, ambiguous players, duplicate
headers, malformed notation, unmatched comments, result mismatches and duplicate move histories.
It legally replays each complete main line from START, then counts only Chigorin's recorded turns.
Every generated continuation is checked against legal moves in its source position. Records are
not silently repaired. `corpus-manifest.json` retains every excluded record index/reason (empty
for this source); `corpus-games.json` retains accepted names, dates, sites, side, normalized moves
and content hashes. Legal validation does not independently authenticate nineteenth-century game attribution.

Runtime imports only `src/book/chigorin-book.json`. Its keys use reversible FEN board text and
the existing canonical turn/castling/legal-en-passant suffix. Import asserts a one-to-one mapping
from the full keys, preserving all occurrences. `scripts/chigorin-history/import.ts` pins both source
fingerprints and reproduces the retained book/facts without network access. Run with Node22:
`node --import tsx scripts/chigorin-history/import.ts`.

[GM Bryan Smith's account](https://www.chess.com/article/view/the-chigorin-queens-gambit-a-history-part-2)
provides qualitative context for knight strength, central/light-square counterplay and attacks.
The off-book coefficients are designed priorities, not a learned model or proof that Chigorin
would have played an individual generated move.
