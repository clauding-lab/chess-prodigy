# Chigorin rated activation report — 19 September 2026 BDT

## Result

Activated the accepted immutable `chigorin/version1/chigorin-plans-v1` Practice Ratings:

| Level | Rating |
| --- | ---: |
| Casual | 1250 |
| Club | 1350 |
| Strong | 1625 |

Only exact, supported Chigorin version 1 configurations are now rated. Unsupported identities,
assisted games, legacy receipts, resume/forfeit behaviour, and account policy 4 protections remain
covered by the existing focused regression suite. No Chigorin playing, book, or search policy changed.

The Home card now uses the approved concise explanation, a direct Wikipedia link, and an enabled Play
button in beta-enabled builds. It matches the parallel no-dropdown Morphy layout.

## Test-first evidence

Updated the former premeasurement game/UI/browser assertions first. The RED run failed for the expected
reasons: the rating map was `null`, Chigorin was unrated, setup rejected measurement, and the old Home
card had no Wikipedia link and a disabled button.

`npm test -- tests/game/rated-chigorin.test.ts tests/ui/Chigorin.test.tsx`

- RED: 6 failures, all caused by the inactive contract.
- GREEN: 2 files / 7 tests passed.

## Verification

Using Node v22.23.0 from `.nvmrc`:

```text
npm run typecheck
npm run lint
npm run format:check
VITE_PERSONALITY_BETA=true npm run build
VITE_PERSONALITY_BETA=true npm run test:browser -- tests/browser/chigorin.spec.ts
```

All commands passed. The enabled build generated a 2,490.03 kB engine worker and a 2,868.18 KiB PWA
precache, under the explicit 3 MiB Workbox ceiling. The focused Chrome Playwright run executed 20
desktop/mobile checks, including every difficulty and colour, offline resume, forfeit receipt, replay,
rematch, disposable-account policy protection, and neutral offline review. Screenshots are retained in
`test-results/chigorin-*`; no failure artifact was produced.

The first browser invocation used Node v26.3.1 and stopped before Playwright began because the local
`better-sqlite3` test module was built for Node 22. Re-running with the declared Node v22.23.0 completed
the suite.

## Supporting accepted evidence

- `docs/verification/chigorin/independent-calibration-review.md`
- `docs/verification/chigorin/independent-audit-20260919.json`
- `docs/verification/chigorin/independent-ui-review.md`

This report records local implementation verification only. It makes no publication, deployment, or
live-player-data claim.

## Review fix round 1

Updated two stale post-activation assertions without changing engine or UI production code:

- `tests/engine/chigorin.test.ts` now verifies that only the exact supported version-1 identity is
  rated; altered version, engine, and seed configurations remain unsupported and unrated.
- `tests/browser/home.spec.ts` now verifies Morphy's concise visible copy, absence of the removed
  dropdown, and the direct Wikipedia link.

`npm test -- tests/engine/chigorin.test.ts tests/game/rated-chigorin.test.ts tests/ui/Chigorin.test.tsx`
passed: 3 files / 18 tests. `prettier --check` for both changed tests and `git diff --check` passed.
Browser Home verification is intentionally deferred to the parent run to avoid overlapping its active
browser suite.
