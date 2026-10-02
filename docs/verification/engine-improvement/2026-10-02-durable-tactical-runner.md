# Durable tactical runner — 2 October 2026 BDT

Local infrastructure checkpoint only. No playing policy, rating, application behavior, original failed schedule or release changed. The actual validation partition was not read or executed. Synthetic tests used disposable registries; no real final programme slot was consumed.

## Implemented

- `tactical-manifest.ts` verifies the independently supplied raw dataset SHA-256/count, unique sample IDs, legal SAN histories from START, exact `fen` roots and production terminal exclusions. It generates two reference tasks and sixteen decisions per eligible position, fixed seeds, levels, identities and parity order. The manifest also records the separate 1,600-game recipe.
- `tactical-evidence.ts` checks full reference coverage and provenance, candidate/own-v1 moves and timings, converts both colors' scores, applies the existing shared two-depth classifier and whole-source-game bootstrap, and produces separate group statistics. Programme qualification is always false. Anonymous A/B material uses canonical move projections and a separate private identity mapping.
- `tactical-runner.ts` claims the fixed final slot before the dataset reader, freezes exclusive files, consumes execution before work, records each start/result, stops on failure and refuses retry. Exact write-time result/start hashes bind completion. Assembly reconstructs the schedule and revalidates every record; missing, extra, edited or failed rows never reduce the denominator.
- `tactical-worker.ts` runs unchanged E1 in fresh threads and reuses the reviewed production decision transport. Reference failures preserve request, stage, timing, capacity and exit details. Unknown exception data retain a readable projection plus binary evidence; a serialization limitation is recorded if the binary format cannot represent a value.

## Review and regression evidence

Each module began with an observed failing import before implementation. Additional defects were reproduced as failing behavioral tests before correction:

1. A coherent legal-result edit initially passed semantic validation. Write-time hashes now reject even a valid-looking timing/move edit.
2. A cyclic BigInt exception initially erased its failure record. Retention now preserves the original error and lossless data.
3. Reference startup/calculation failures initially lacked diagnostics. Synthetic worker exit/crash and controlled-clock timeout checks now assert retained evidence.
4. Unknown move/reference properties could enter anonymous packets. Explicit canonical projections now strip that metadata.

Independent code and TypeScript reviewers closed all findings, including the final anonymous projection change, with approval within the documented API boundary.

Verification: `npm test -- --maxWorkers=2` passed **125 files / 1,116 tests** (including 23 new tests); `npm run typecheck`, `npm run lint` and `npm run format:check` passed. The full suite includes the final anonymous projection regression. The full-suite log is retained in `2026-10-02-durable-tactical-runner-evidence.tar.gz`. The implementation leaves engine/application sources untouched.

## Operational boundary

This is a tactical runner API, not an executable final qualification programme. There is no CLI selecting or opening validation data. A reviewed operational caller must supply the canonical retained registry, independently verified full-dataset identity/count, unpredictable private nonce, and a complete source/book/bundle/settings/machine inventory. `tacticalContext` hashes supplied contents; it cannot discover omitted inventory or establish that a caller is honest. The local registry prevents accidental repeat attempts within that registry; it is not tamperproof against deliberate deletion or rewriting of the evidence store.

The separate complete-game executor/schedule, independent anonymous audit, owner blind comparisons, physical phone checks and any later rated calibration remain unfinished gates. A tactical statistical criterion is not release qualification. No final validation execution, deployment, push, merge or release is included in this checkpoint.
