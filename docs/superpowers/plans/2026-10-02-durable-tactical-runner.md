# Durable tactical runner implementation plan

> **For agentic workers:** Use superpowers:executing-plans for native implementation. Independent code/TypeScript review is required before acceptance.

**Goal:** Make tactical collection and assembly reproducible, fail-closed and one-attempt, without opening reserved validation data.
**Architecture:** Separate manifest/history validation, durable run orchestration, semantic evidence/report assembly and real-worker adapters. Tests use synthetic legal histories and injected executors.
**Tech Stack:** TypeScript, Node filesystem/worker threads, existing chess rules and tactical classifier, Vitest.
**Spec:** docs/superpowers/specs/2026-10-02-durable-tactical-runner.md

## Global constraints

No real validation dataset access, no final submission invocation, no engine-policy/source changes, no rated activation or publication. Preserve every original benchmark artifact and failed attempt. Final qualification always false. Final use requires a canonical retained registry and independent acceptance beyond this API.

## Tasks

- [x] 1. `tactical-manifest.ts`: validate raw dataset/hash/count and legally replay histories; create deterministic exact schedules and retained terminal exclusions. Tests: altered hash/count, duplicate IDs, post-terminal and wrong FEN, correct 16N/2N coverage/order. Observe failing import/assertions before implementation.
- [x] 2. `tactical-evidence.ts`: validate reference and candidate/baseline outputs, classify complete result maps and build anonymous review packet/private mapping. Tests: wrong/missing/extra/duplicate evidence, both-color conversion, thresholds, policies, timing and identity leaks. Use existing sharedTacticalFailure/clusteredFailureInterval; do not copy their math.
- [x] 3. `tactical-runner.ts`: claim final programme slot before dataset callback, freeze exclusive files/digests, consume run once, preserve task starts/results/failures, verify context each boundary. Tests use disposable directories and injected executors; prove retry/second-directory refusal and failed-read/partial-run preservation.
- [x] 4. `tactical-worker.ts`: real fresh-worker E1 reference adapter plus reviewed strength worker transport for decisions. Freeze/verify context externally; test a bounded synthetic reference transport, no real validation input.
- [x] 5. Run focused tests, typecheck/lint/format, full suite. Independent code/TS reviews; close material findings with regressions. Record limitations/evidence, local Conventional Commit, clean worktree.

## Review focus

- Source/context check must precede every execution and precede classifying output; no failed task can become a smaller denominator.
- Final slot must be consumed before the dataset reader and remain consumed after any exception; no second output directory bypass.
- Persisted evidence must be revalidated rather than trusting a saved verified flag.
- Every selected move and reference score must belong to the same legal root/history and requested policy/depth.
- A/B packet must omit identity/policy details and retain separate private mapping; no statistical result becomes programme qualification.

Ruling: the owner explicitly requested autonomous continuation; execute locally without repeating a plan-approval request. The actual validation partition remains closed. The complete-game executor is a separate gate and is not implied complete by this tactical API.
