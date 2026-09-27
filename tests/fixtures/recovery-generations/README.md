# Historical terminal recovery fixtures

These are synthetic games, not player data. Each file was produced by executing the historical implementation recorded in `manifest.json`, rather than changing the version field on a current save.

For each of the seven source commits, `git archive <commit> src` was extracted into an isolated local evidence folder. An esbuild Node bundle imported that checkout's `freshSession`, `reduceSession`, legal move/SAN functions and `saveState`. It started at **2 September 2026, 00:00 BDT**, played the legal Fool's Mate sequence `f3 e5 g4 Qh4#` at each Classic difficulty, and retained exactly the JSON emitted by that historical save function. The source state/store and output SHA-256 fingerprints are in the manifest. Earlier fixture files are immutable.

`tests/storage/historical-terminal.test.ts` checks each fingerprint, legally loads its nonempty history, pins Classic's public Practice Ratings at 900/1350/1800, migrates to current storage, reloads the exact historical rating and receipt, checks the archive, preserves the original recovery key, and verifies that corrupt current authority cannot fall back over it.
