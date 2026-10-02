# Fischer diagnostic probe v1 — 2 October 2026 BDT

Owner approved the bounded probe: examine the saved failure position plus the existing 12 development positions, measure history preparation versus move comparison using isolated frozen-engine copies, retain all outcomes, and make no playing-policy or strength-result changes.

This is a diagnostic exception permitting examination of the single failed position. It does not resume or replace the failed game, rerun its complete seed schedule, alter its marker, or qualify any candidate. The original complete-game protocol remains stopped.

## Prospective schedule

Use source archive 521fef2 and verify every original source fingerprint. Read only the development partition and its existing 12-position cohort manifest. Legally reconstruct each history and check FEN. Append the saved failure position as row 13, reconstructing its 30 recorded moves. No validation partition is read.

For each row, in fixed order:

1. One fresh Node worker using the frozen Fischer2 Casual production decision entry, 200 ms including its unchanged 30 ms ranking reserve. Diagnostic seed 317 for development rows; original 3459648129 for the failure-position inspection. No move is applied.
2. One fresh Node worker using the same frozen search with baselineOnly, depth 2, constant-zero search clock, positive clock budget and 1,000,000-node cap. This isolates the work required to complete the shallow baseline; its measured elapsed duration is diagnostic and never production strength evidence.

Each invocation has a 15-second startup-inclusive safety cap. No warm-up, retry, source tuning, setting changes or optional extra positions. Retain errors/incomplete results and continue only through this predeclared diagnostic schedule. No win/draw/loss result is generated. Record the full request/result, startup and calculation duration, machine/Node and bundle/source hashes before running.

## Instrumentation and interpretation

An in-memory build copy adds timestamps at search entry, completion of history/root preparation, baseline start/end and search return. Product files and the archived source are never edited. Keep all added code and bundle hashes. Diagnostic timestamp overhead can change elapsed-search outcomes; these are instrumented observations, not exact reproduction of the original worker timing.

Record each search call separately: zero-budget terminal preflight and the actual search both prepare history. Fixed-baseline mode determines whether the shallow baseline completes within its node cap and measures its current wall time. Do not infer the original process's scheduling, garbage collection or exact lost response from this later run. Compare preparation and baseline contributions descriptively, without statistical strength claims or per-position tuning.

Run sequentially with this task's tests and benchmarks stopped. Disclose visible unrelated CPU load; do not terminate other work. Check result identity and legal moves. A diagnostic result does not select a new engine policy. Any retained repair needs its own reviewed design, distinct version and subsequent measurements.
