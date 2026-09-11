# Personality PWA — Run 2 verification

11 September 2026 BDT. Scope: next bounded Run 2 after owner “go on”; handoff revision 2.
Plan: `docs/plans/2026-09-11-personality-pwa-run2.md`.

Persistent checkout `/Users/adnanrashid/Projects/chess-prodigy`, branch
`codex/personality-pwa-run2`, base `8a5a472f7301b4794d3f6a99ab2c03a4b749c0a1`.
No pre-existing changes. Node 22.23.0 / npm 10.9.8. No production access or release actions.

## Baseline — passed (R2.0)

| Command | Result |
| --- | --- |
| `npm test` | exit 0; 247 tests / 28 files |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:browser` | exit 0; 52 passed, 4 existing intentional skips |
| `npm run test:accessibility` against preview 4173 | exit 0; both themes 100 |
| `git diff --check` | exit 0 before checkpoint commit |

R2.0 complete (`48ee845`); R2.1 implemented/checked; R2.2–R2.3/final not-started; Run 3 deferred.
Carried baseline limitation: WebKit offline new-page navigation failed identically on
Run 1 and untouched `f2b45b7`; physical iPhone checks remain pending.

Baseline logs: `/tmp/chess-prodigy-run2/baseline-*.log`. Browser-generated screenshots
were retained there and the four tracked baseline images restored. Browser skips are the
same account/mobile and touch-only duplicates recorded in Run 1. Frontend preview's missing
optional API on 4317 causes expected proxy diagnostics; account tests use disposable 4318.
No application, test, configuration or schema edits preceded this record and baseline.

## R2.1 — identity, migration and rating foundation

- Red-first checks failed for missing new configuration/migration APIs (`r21-red.log`).
- Focused final game/storage/account-sync/server checks: exit 0, **90 tests / 8 files**.
  Archive legacy-projection check: exit 0, **1 test / 1 file** (`r21-record-tests.log`).
- Typecheck, lint, format and diff checks: exit 0. A formatting failure in server/records.ts
  was corrected normally; no hooks/checks bypassed.
- Interim full unit/server/UI suite before the last two review regressions: exit 0,
  **259 tests / 30 files**. Final run verification still pending; browser assertions were
  mechanically updated to observe v2 authoritative keys, with dedicated v1 migration fixtures.
- Two independent reviewers checked schema, rating, local caches, queue durability, server
  ownership/version transaction and archive undo/recompletion. Data-path reviewer reproduced
  stale annotations on unsupported config. Added failing test (`r21-review-red.log`), removed
  the normalization bypass, and passed the final focused tests. TypeScript review: no findings.
- Beta terminal/undo/recompletion preserves seed/config and zero rating/leaderboard effects.
  Unknown-version StrictMode hook test: no worker, clock settlement, reset, replacement or write.

Logs under `/tmp/chess-prodigy-run2/r21-*.log`. Actual branch/base unchanged. No unrelated files
or pre-existing work were encountered. Supported-config UI/engine play is not yet implemented.
Migration/rollback details are in the plan. No new SQL tables, production access or external calls.

Next: implement and verify R2.2 style and worker/book integration; then minimum UI (R2.3).
