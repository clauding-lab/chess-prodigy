# Historical source record — 19 September 2026 BDT

The retained [PGN Mentor catalog](https://www.pgnmentor.com/files.html) lists the downloadable
[Spassky](https://www.pgnmentor.com/players/Spassky.zip),
[Tal](https://www.pgnmentor.com/players/Tal.zip), and
[Fischer](https://www.pgnmentor.com/players/Fischer.zip) collections. Original catalog HTML,
ZIP archives and extracted PGN bytes are retained here. Source pins in
`scripts/roster-history/source-pins.ts` prevent silently replacing any original bytes; each manifest
also records the date, exact player identity, hashes, accepted/excluded records and book fingerprint.

| Player | Accepted | Excluded | Distinct positions | Recorded continuations |
|---|---:|---:|---:|---:|
| Spassky | 2231 | 0 | 61120 | 76469 |
| Tal | 2431 | 0 | 70823 | 86860 |
| Fischer | 826 | 1 | 28384 | 33738 |

Exact aliases: Spassky `Spassky, Boris V` and `Spassky,B`; Tal `Tal, Mihail`;
Fischer `Fischer, Robert James`. No fuzzy matching. The first Spassky import excluded46 alias
records; inspection and explicit alias acceptance restored them. The first Fischer import excluded
record70, Hearst–Fischer (New York1957), because its event reads `Team championchip`. That rule was
incorrect: an individual game in a team tournament is ordinary chess. The parser now distinguishes
consultation/variant descriptions and combined player identities from tournament labels. Rebuilding
restored that full legal game (825→826 accepted,28336→28384 positions,33679→33738 continuations).
Record449 remains excluded: Fischer vs `Sillars,K/Manter,L`, Cicero1964, combined opponents.

Every full history is legally replayed. Rebuilt compact keys are checked against full position keys
for collisions, and every recorded continuation/count is revalidated. Exact duplicate histories,
nonordinary/setup games, malformed records and illegal moves receive explicit exclusions. Runtime
imports only compact books; full source histories remain verification evidence. Occurrence weighting
is preserved, not capped to a few favorite lines. Terminal game semantics are checked before lookup.

These records support documented move claims only. Designed off-book priorities are not reconstructed
historical thought, and neither this corpus nor behavior fixtures establish playing strength.
