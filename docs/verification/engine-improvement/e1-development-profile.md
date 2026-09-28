# E1 development profile — 28 September 2026 BDT

Local inactive `next-neutral-v1`, Node22.23.0, Apple M5 Pro. No existing opponent,
playing policy, book or rating changed. This is calculation telemetry, not playing strength.

The corrected profiler reused exactly the frozen E0development12 cohort and verified both its
development-data fingerprint and E0's serialized-manifest fingerprint. It legally replayed source
histories, passed prior positions excluding the root, and checked every returned move for legality.
It did not read the validation partition. All active browser/unit verification had ended before
measurement; no other agent benchmark or test ran during it. Ordinary desktop background work
was not disabled, so this is an isolated task run rather than laboratory hardware evidence.

Command: `node --import tsx scripts/engine-bench/profile-next.ts docs/verification/engine-improvement/e1-development12-profile-v1.json`.
All36 decisions completed at least one full forcing-search comparison. Each ended by its deadline
while retaining the last completed comparison; none returned incomplete or a baseline-only result.

| Budget | Completed decisions | Completed depth range (half-moves) | Maximum search wall time |
|---|---|---|---|
| Casual200ms |12/12|2–4|200.266ms|
| Club600ms |12/12|2–4|600.078ms|
| Strong2000ms |12/12|3–5|2000.077ms|

Legal source-history replay was measured separately, maximum22.976ms. Search wall time excludes
post-search legal-result checking. Fixed Casual→Club→Strong order without separate warm-up can
favor later levels through code/cache warming; do not infer tier strength or speed ratios.
The12 positions come from four development source games, not independent validation observations.
No worker, book or personality ranking is included, and this is not physical-phone evidence.

Profiler verification: original timing/cohort-shape regressions RED3 then GREEN4; independent TS
review added frozen-cohort binding regressions RED2 then GREEN6. The original cohort's manifest
hash uses compact JSON serialization, matching the retained E0 runner. Code/TS review findings
were addressed before measurement. Source hashes, full result candidates, settings and per-row
telemetry are retained in the JSON artifact.

Next experiment: preserve E1 unchanged and isolate capture ordering in a new inactive policy.
Require exact common-depth candidate-score agreement before comparing completed nodes or timed
work. Any apparent efficiency gain still requires tactical, complete-game strength, app and owner
personality gates; it cannot activate rated play.
