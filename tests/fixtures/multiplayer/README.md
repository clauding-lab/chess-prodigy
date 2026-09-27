# Retained multiplayer fixture

`v1.2-active.json` was generated from retained tag `v1.2.0`
(`413cbab29f469d3a8959a60e3294d32e7bed724d`), executing that tag's
`src/game/state.ts` (and its retained source dependencies), not current code.

Input: `freshGame({playerColor:"w",level:"club",time:"none"},1780000000000,"legacy-game")`,
then `reduceGame` with White's e2-e4 (`from:52,to:36`, `book:false`,
`now:1780000001000`). Revision is 2 to represent join followed by the first move.
The test installs it into a disposable authenticated SQLite game, replacing only
its game ID and revision to match that row. There is no player data in this fixture.
