# CI verification deadline diagnosis — 19 September 2026 BDT

Scoped fix commit: 362b3b2. Only tests/engine/chigorin-corpus.test.ts and tests/calibration/matches.test.ts changed.

CI run35452991863 completed535 cases:532passed,1skipped,2deadline failures. The fingerprint rejection test took24,502ms against a20,000ms budget. It sequentially starts ten independent Node/tsx processes (one initialization, seven mutated manifests, one mismatched protocol, one unsupported protocol), retaining every status/error assertion. Local focused execution takes8,113ms. Increase only this test's outer budget to60,000ms.

The Chigorin full688-game legal reconstruction worker was terminated by its110-second parent timer. The unmodified staging run reproduced exactly the110-second cutoff; before termination its process was consistently CPU-bound, about101%, rather than blocked on I/O or waiting for a child. Local focused full reconstruction passes in46,255ms. Use the same600-second child /620-second outer bounded corpus-validation budget already applied by tests/engine/roster-corpus.test.ts. Complete replay, every legal occurrence and deep equality against the checked-in book remain unchanged. No sampling, skipped assertion or partial corpus is introduced.

These are offline source-validation/test-process deadlines. No engine playing policy, production move budget/watchdog, book, repertoire, or statistical calibration changes. No strength rerun.

Local check: npx vitest run tests/engine/chigorin-corpus.test.ts tests/calibration/matches.test.ts →22/22passed,2/2files,46.77seconds,exit0. Raw log:/tmp/chess-roster-ci-timeouts-local.log. Narrow Prettier and git diff checks pass. Linux focused rerun pending completion of the pre-existing full staging suite; original /tmp/chess-roster-test.log preserved.

## Follow-up RPC diagnosis and resolution

CI35453526412 after362b3b2 passed all534 runnable cases (1skipped) but failed on a Vitest onTaskUpdate RPC timeout. Installed Vitest3.2.7's worker RPC default is60,000ms (node_modules/vitest/dist/chunks/index.B521nVV-.js DEFAULT_TIMEOUT); status ACK processing needs the worker event loop. matches.test.ts chained spawnSync waits across a76-second CI file, starving that event loop even though every individual assertion passed. Original Linux full run and first focused run reproduced the same RPC symptom.

Commit33fe0b1 replaces only matches.test.ts subprocess waits with asynchronous execFile in tests/calibration/process.ts. Children have15-second deadlines and1MiB output bounds. Numeric nonzero exits retain status/stdout/stderr for all rejection assertions; spawn/signal/buffer/deadline errors reject the test. New regression tests verify parent heartbeat during child work, output, expected nonzero status, and deadline rejection. No ignored errors, RPC timeout changes, corpus reduction, playing or production watchdog changes.

Local async matches19+helper3:22/22passed,20.98s,exit0. A narrow helper TypeScript narrowing correction followed; strict standalone helper TypeScript, Prettier and helper3/3 rerun passed. No runtime source files changed.

Linux evidence, all under disposable /tmp/chess-roster-stage-c95dd12-complete with exact approved test copies:
- Original full suite:530passed,4timeouts,1skipped plus1RPCerror,692.22s. Original /tmp/chess-roster-test.log left untouched.
- First focused twofiles after362: Chigorin3/3passed, complete reconstruction274.480s; matches18/19 with only default5s forced-mate timeout. Overall21pass/1fail plusRPCerror,407.20s. Retained /tmp/chess-roster-ci-timeouts-linux.log. Corpus stayed CPU-bound at~100%; no corruption or book mismatch. This is complete proof, not a sampled corpus.
- After33fe0b1: npx vitest run tests/calibration/matches.test.ts tests/calibration/process.test.ts --maxWorkers=1 --testTimeout=20000:22/22passed,113.59s,exit0, no unhandled errors. Forced-mate case5.444s and fingerprint loop39.765s. Retained /tmp/chess-roster-async-linux.log. The CLI20s is the offline staging default for the slower server; explicit60s fingerprint test remains intact. No product limit changed.
- npx vitest run tests/engine/roster-behaviour.test.ts --testNamePattern="tactical safety, terminal-before-book and pins" --maxWorkers=1 --testTimeout=20000:both reflected casespassed (4.686s/3.013s),12unrelatedcases not selected,13.65s total,exit0. Retained /tmp/chess-roster-tactical-linux.log.

The initial focused subprocess run briefly overlapped the controller's build; free-memory evidence showed656MBavailable/1029MBswap then recovered above2GBavailable after build. Subsequent async run had no build overlap and no errors. No OOM observed. All failed Linux cases are now covered successfully in explicitly separate runs; no clean full-Linux-suite claim is made. All log copies also fetched to this Mac at identical /tmp basenames for release documentation. No active verification jobs remain from this worker.

## Retained release evidence

Local diagnostic and focused logs are committed alongside this note: `ci-timeouts-local.log`,
`ci-timeouts-linux.log`, `async-local.log`, `async-linux.log`, `tactical-linux.log`, and the
unchanged original run copied as `original-linux-tests.log`. Copies normalize only trailing
whitespace. All displayed Vitest raw Start-at fields in Linux logs are machine output; add six
hours for BDT. Both code fixes have separate controller-requested independent reviews.
