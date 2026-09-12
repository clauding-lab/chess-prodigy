# Mikhail Chigorin — approved design

On 12 September 2026 BDT the owner requested “build chigorin” and approved documented
Chigorin moves plus designed active-knight, central-counterplay and coordinated-attack priorities.
Implement directly in the existing app using the successful Morphy process. This is a new visible
opponent; preserve Classic and every Morphy policy, game, rematch and fixed rating receipt.

## Playing contract

Identity: id `chigorin`, version 1, engine `chigorin-plans-v1`, randomPolicy
`seeded-per-ply-v1`. Seed is an unsigned 32-bit integer. Documented legal continuations
at matching positions are selected by recorded occurrence counts; no Classic/Morphy book substitution.
Import https://www.pgnmentor.com/players/Chigorin.pgn, preserve its fingerprint and full excluded-record
reasons. Only exact accepted Chigorin player identities in ordinary starting-position games qualify.
Exclude duplicates, illegal games, odds, setup, consultation and ambiguous identities. Keep original
source and accepted game facts outside runtime imports; runtime loads compact book only.

Off-book design uses current position, seed and ply, with no hidden session memory:
- Develop useful minor pieces and castle while avoiding repeated early queen moves.
- Improve knight activity and supported central advanced squares that enemy pawns cannot immediately attack;
  never reward moving a pinned knight as though it could contribute freely.
- Challenge enemy central pawns with legal piece pressure and useful pawn contact/breaks that improve activity.
- Coordinate distinct pieces against the opposing king when sufficient material and safe own-king conditions
  support attack. Endings retain useful knight activity without manufacturing a king attack.
Designed preferences are openly described as Chigorin-inspired, not learned or historical move claims.
GM Bryan Smith's https://www.chess.com/article/view/the-chigorin-queens-gambit-a-history-part-2
supports knight strength, central/light-square counterplay and attacks; it is qualitative context,
not proof that any particular computed move is historically correct.

Reuse neutral complete-depth root search under production depth/time limits (1/200ms, 2/600ms,
4/2000ms); reserve 30ms for ranking within the same deadline. Scores eligible for style must be
within 100 centipawns (one pawn of engine assessment) of best; preference bonus capped at 240.
Complete winning/losing mate scores use best neutral move. Incomplete search/ranking returns neutral
legal fallback. Terminal positions have no moves. Public scores remain White perspective; root scores
remain side-to-move perspective. Freeze coefficients and behavior criteria before strength games.

## Behavior evidence and measurement

Before implementation, define both-color real chess positions for knight placement, central challenge,
development, attack coordination and tactical traps. Verify actual selected moves, bounded neutral loss,
pinned-piece handling, mate/free material, legal fallback, deadlines, and deterministic saved identities.
Compare Classic descriptively, not by mandatory disagreement rate. Use off-book cases and multi-ply
sequences; retain diagnostic evidence. Independently review corpus, policy, behavior and measurement.

Fresh `chigorin-plans-paired-v1` measurement runs production chooseOpponentMove against unchanged Classic,
normal START, swapped-color pairs and seed (0x20260912 + pair * 7919) >>> 0, no adjudication,
max1000 plies. Freeze source before measurement. Check at 50/100/200 pairs, z2.4 approximate pair-Wilson
interval width <=300, no unresolved games, finite estimate 0–10000. Stop at first eligible checkpoint;
round to nearest25. Do not expose normal rated setup until all levels qualify. Never borrow ratings.
If any level fails 200 pairs, report the evidence and withhold rated release.

## Integration and safety

Add one Mikhail Chigorin option to Home/setup behind the existing personality flag. Include concise
historical-opening/designed-priority explanation, difficulty ratings after measurement, records/replay,
rivalry/rematch and Resume behavior. Neutral coach, human games and Classic math remain unchanged.
New Chigorin rating eligibility checks exact id/version/engine, not version numbers alone.
New authority: guest state-v6 / account-v6 / history-v5; preserve all older recovery generations,
corruption blocking and pending account versions. Wire schema2 unchanged. Current client policy4;
accepting Chigorin (including assisted games) permanently raises account minimum to4 through reset.
Previous policies and exact original wire acknowledgements remain intact. Never downgrade that floor.
Default Dark and saved Wooden preferences, active clocks, explicit forfeit, owner isolation and explicit
PWA updates remain intact. Tests use disposable accounts/databases, never live player data.

## Delivery

Build and verify local actual-app implementation, independent review and fresh measurements. Prepare
source and release documentation for version2.5.0. The current request is to build Chigorin; complete
local verified work before any separate publication decision. No paid dependency, Stockfish, additional
opponents, automatic update/reload, or real-player-data operations.
