# Chigorin strength measurement — accepted 19 September 2026 BDT

The accepted fixed Practice Ratings for `chigorin/version1/chigorin-plans-v1` are
**Casual 1250 / Club 1350 / Strong 1625**. All 400 complete games were independently
replayed, and the retained compressed copy was matched to the original evidence.
See [independent review](independent-calibration-review.md) and
[evidence bundle](calibration-20260913/README.md).

## Frozen method

Playing source was frozen at `adfc0060635fc5d4ee7dc8103dac3722c732408c` before measurement.
The 331-file archive and extracted source fingerprints matched during the later audit.
Games completed on 13 September 2026 BDT; independent acceptance occurred on 19 September.
The protocol `chigorin-plans-paired-v1` uses production Chigorin against unchanged same-level
Classic, whose internal anchors are 900 / 1350 / 1800. Each pair starts from the standard
initial position and swaps colors, with seed `(0x20260912 + pair * 7919) >>> 0`.

Depth/time limits are 1/200ms, 2/600ms and 4/2000ms, including Chigorin's 30ms ranking reserve.
There are no forced opening lines, adjudications or resignations. Games end by chess rules;
any unresolved game at the 1000-ply bound invalidates the checkpoint. The recorded environment
is Node 22.23.0, Apple M5 Pro, arm64 macOS, 15 logical CPUs, eight pair workers within one level
at a time. Wall-clock search depth can vary; recorded games are not a deterministic timing replay.

Declared checkpoints are 50 / 100 / 200 pairs. The existing approximate pair-Wilson interval
uses z=2.4 and must be at most 300 rating points wide, with a finite estimate in 0–10000 and
no unresolved outcomes. Stop at the first eligible checkpoint; round its estimate to nearest 25.

| Level | Pairs / games | Wins / draws / losses | Estimate | Interval | Eligible | Fixed rating |
| --- | ---: | --- | ---: | --- | --- | ---: |
| Casual | 50 / 100 | 76 / 19 / 5 | 1208.239245 | 1046.668977–1369.809513 | No | — |
| Casual | 100 / 200 | 160 / 30 / 10 | 1238.039216 | 1114.587785–1361.490647 | Yes | 1250 |
| Club | 50 / 100 | 19 / 65 / 16 | 1360.426196 | 1244.606591–1476.245801 | Yes | 1350 |
| Strong | 50 / 100 | 2 / 51 / 47 | 1631.597875 | 1502.537500–1760.658250 | Yes | 1625 |

Casual extended only after its 50-pair interval was too wide. Neither Club nor Strong needed
an extension. There were 31,107 legally replayed plies, 254 checkmates, 144 threefold repetitions,
one stalemate and one insufficient-material draw. No eligible level was repeated.

## Evidence and limits

The separate verifier reconstructs statistics, terminal results and repetition checks without
importing the calibration estimator or match verifier. It does share frozen board legality,
SAN conversion and insufficient-material rules. Its negative self-tests reject tampered
scores, positions, seeds, moves after game end and impossible aggregate timings.

Raw games, worker and checkpoint verification logs, source inventory and unchanged source/archive
remain at `/Users/adnanrashid/Downloads/chess-prodigy-chigorin-20260913/`.
The repository pack retains every raw game as canonical JSON, with original and canonical-line
fingerprints and metadata. Exact reproduction instructions are in the independent review.

These values measure internal practice strength against this app's Classic anchors. They do not
certify FIDE/human strength, perceived Chigorin style, tactical perfection or other hardware.
Per-move timings and observed scheduler concurrency were not recorded. No previous Morphy rating
or receipt changes. Any future playing-policy or repertoire change needs a new identity and fresh
measurement. Rating acceptance alone does not establish app verification or deployment.
