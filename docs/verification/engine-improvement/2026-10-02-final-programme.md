# Final programme machinery — 2 October 2026 BDT

Owner instruction: “complete all.” This checkpoint completes the previously registered final tactical/complete-game machinery. It does not itself establish improved strength, qualification, ratings or release readiness.

## Before exposure

- Canonical joint registry and output path are fixed in `final-context.ts`; the tactical freeze consumes the one programme claim before the held-out dataset reader. The full E0 validation SHA-256 and 160-record count are pinned from the existing manifest.
- Sources/books, harness/reporting code, dependency lockfile, protocol, tests, machine and all six worker bundles are inventoried. Preflight confirms the experiment/Tal/Fischer bundles exactly match the original frozen development bundles. Spassky/Chigorin use their unchanged production worker paths.
- All 1,600 complete games have fixed paired colors/seeds: each candidate gets Strong own-v1 200 pairs, Strong Spassky 50, Strong Chigorin 50, Club own-v1 100. Every ply is legally replayed and its timing/detail/provenance verified. Only genuine terminal games enter the paired reports.
- Exclusive game starts/results, exact evidence hashes, source checks, and no-restart markers retain failures. Invalid non-JSON output and uncloneable exceptions get explicit retained failure records.
- Execution/evidence failure stops immediately. Completed statistical failure still collects the entire registered programme; it never qualifies. This stopping rule was recorded before exposure.

Sequencing disclosure: synthetic tests instantiated the deterministic production seed schedule before the final claim, earlier than the literal schedule-generation wording in the original contract. They used fabricated legal outcomes and no actual candidate searches with those seeds. No validation positions or outcomes were exposed. Independent review accepted this disclosed arithmetic-test deviation before execution; it is not erased or misreported as “no validation seeds generated.”

## Verification

`npm test -- --maxWorkers=2`: **128 files / 1,124 tests passed**. TypeScript, ESLint and formatting checks passed. Production cross-opponent routing was tested from START; synthetic whole-schedule reporting and fault-retention tests passed. Full-suite log retained in the matching evidence archive.

Independent code/method review and TypeScript review approved final execution readiness after correcting malformed-output retention and recording the prospective method details above. They did not open validation data or run final searches. Their approval is conditional on passing checks and committing the reviewed source, not an approval for ratings or release.

## Remaining boundaries

The original Fischer Casual development failure remains retained and unresolved; subsequent evidence cannot rewrite it. Actual final outcomes will be recorded separately. Owner blind comparison, real-device observations and any fresh rated calibration remain independent gates. No deployment, merge, push or rating activation occurs in this checkpoint.
