# R19 — compatibility and recovery integration

28 September 2026 BDT. Local repair worktree; no publication, deployment, real accounts or live-player data. Base checkpoint `f842025`; subsequent inactive engine work by the coordinator is outside this compatibility change.

## Authority contract

Read guest generations1–7, account generations1–7 and history generations1–6; write guest/account v8 and history v7. Present corrupt current authority blocks fallback/overwrite. All older key bytes stay available for recovery. Compact wire3 explicitly records essential moves, clocks, opponent/version/seed, assistance, rating and receipt; positions/SAN are legally reconstructed and neutral-review caches are deliberately omitted. Legacy wire1/2 pending writes retain their exact original representation and ordering, including attempted writes, raw success/409 acknowledgement matching, and the original rejected payload after explicit compact retry.

Compact acceptance permanently raises the account policy floor to6. Older clients receive426 before a conflict can disclose replacement state. Reset never lowers that floor. Separate authenticated ownership and browser writer leases remain mandatory; guest games never import into an account. Quota/transport rejection keeps pending progress and offers a private export. Temporary play is separate and unrated.

## Matrix and retained evidence

| Boundary | Executable evidence |
| --- | --- |
| Every old identity, difficulty and assistance mode | `tests/storage/compatibility-integration.test.ts`:81 combinations of Classic1, Morphy1/2/3/4, Chigorin1, Spassky1, Tal1, Fischer1; Casual/Club/Strong; unassisted/hint/takeback. Legal terminal histories preserve exact receipt, rating and original rematch configuration through guest v7→v8, then original pending account v7→v8 acknowledgement. Both old keys remain exact. These are synthetic compatibility sessions, not newly measured engine games. |
| Genuine historical implementations | Existing `historical-terminal.test.ts` reuses21 nonempty terminal fixtures produced by seven historical source generations at all three Classic difficulties. Source/output fingerprints and exact receipt checks are unchanged. |
| Every prior authority generation | Existing `roster-generation`, `chigorin-generation`, `repair-generation` storage/account tests exercise all seven prior guest/account keys and six prior history keys, current corruption precedence, ordered pending versions and failed new-authority writes. |
| Raw pending/reload/conflict/upgrade | Existing account `sync`, `recovery`, `history` tests retain raw attempted acknowledgements, later pending results, upgrade-required queues, conflict rebase, disposed callbacks, malformed responses and archive displacement recovery. |
| Reset/server restart/policy floor | Added real SQLite/application restart in `compact-records.test.ts`: exact acknowledged response survives restart, policy5 write remains426, stale policy6 retry receives the original409 current response without duplicating a write. Existing compact and legacy HTTP cases cover reset, assistance, oversized payloads, transactional archive/receipt restoration and policy monotonicity. |
| Memory-only temporary transition | Mounted `AccountShell.test.tsx` reproduces quota-failed pending progress reaching push cancellation without recovery. Entry now requires durable retention or the exact exported pending content, rechecked after asynchronous push reconciliation and against the original sync instance. Fresh downloaded/unstarted state with no pending edits exposes temporary entry directly. |
| Built browser | Current readers use the production compact decoder; legacy seeds stay explicit. Review tests observe actual native-worker replies and visible review completion because derived review caches are not persisted. Browser ownership tests require explicit takeover, and denied-storage recovery uses the disposable real account server. |

## Frozen policy audit

E0 dataset manifest has36 source fingerprints.35 match exactly. The sole difference is `src/engine/reviewer.ts`, the separately authorized R11 neutral-review-v2 upgrade; it is not an opponent move-selection policy. All frozen playing engines, evaluations, books, historical models, opponent definitions and ratings in that manifest remain exact. Expected/current reviewer hashes are retained in `r19-frozen-source-audit.json`. No old opponent version or receipt is repriced.

## Commands and observations

- Node22 selected through `.nvmrc`.
- Initial new temporary-retention regression: RED1, missing required recovery barrier before push cancellation. Narrow pre/post-reconcile correction: mounted shell18/18 GREEN, including asynchronous changed-progress and fresh storage-denied entry.
- `npx vitest run tests/storage tests/account tests/server/compact-records.test.ts`:301/301 GREEN across24 files, including the81-case matrix and21 retained historical fixture checks.
- `npx vitest run tests/storage/compatibility-integration.test.ts`:81/81 GREEN. Initial rematch fixture incorrectly omitted the explicit opponent when constructing setup; corrected to the actual UI contract. This was a fixture error, not a production engine regression.
- `npx vitest run tests/account/AccountShell.test.tsx tests/server/compact-records.test.ts`:22/22 GREEN.
- Initial built default-off desktop browser checks exposed obsolete raw-v7 readers, exact storage-revision comparison, concurrent-writer assumptions and pre-recovery UI paths. Those fixtures were aligned with the approved authority/ownership contract. A later review-probe test needed context-level installation for newly opened offline tabs. Those failures are not claimed as production fixes.
- `VITE_PERSONALITY_BETA=false npm run build` then `VITE_PERSONALITY_BETA=false npx playwright test --project=desktop`:129 cases,90 passed,35 explicitly enabled-only skipped,4 failed on obsolete coaching wording/old-policy reset fixtures. All four corrected expectations plus the new R08 interrupted-computer test and strengthened live-coaching checks subsequently passed:7/7. The roster fixture still seeds legacy policy5 first, then verifies the current client raises the permanent floor to6 and reset rejects policy5.
- Default-off mobile viewport critical matrix (`accounts`, `multiple-tabs`, `home`, `production`, `reviewer`, `update`):19 passed,3 explicit desktop-only account checks skipped. Actual Home reload, private ownership/recovery, offline play, keyboard/accessibility, update and live-review journeys ran on the built artifact.
- Reviewer contamination checks observe both native calculations and accepted visible coaching. An injected AI score8888 must never render its false mate verdict, including transient mutations; after reload, stale legacy annotations disappear and native neutral review recomputes.
- `VITE_PERSONALITY_BETA=true npm run build` succeeded. The full desktop+mobile browser suite was stopped at the owner's request:28 desktop tests passed,1 test interrupted,231 not run. This is partial enabled evidence, not a passed enabled matrix. The interrupted board-focus case is not a reported behavioral failure.

## Remaining gates

Independent review of the final test changes and completion of the enabled built browser matrix remain. The scoped AccountShell fix has coordinating-agent code-review approval; final test review requested stronger live coaching observation, which was added and passed on both desktop and mobile before the enabled run. Physical-phone suspension/startup, real screen-reader operation and owner blind personality evaluation are separate gates; desktop/mobile viewport automation cannot establish them. No strength or perceived-style claim follows from compatibility evidence.


## Paused at owner request — 28 September 2026, 00:29 BDT

The owner needed to close the session. Stopped the active enabled Playwright runner with SIGINT: PID27490 (npm parent26658), unified execution session15427 exited130. Its preview PID27521 and disposable account server PID27523 also exited; a subsequent process listing found no remaining Playwright/preview/test-account-server process. No commit, push, deployment, data discard or additional verification was performed after the stop request. The built `dist` is the enabled artifact.

Current R19 edits are uncommitted: `src/account/AccountShell.tsx`; `tests/account/AccountShell.test.tsx`; `tests/server/compact-records.test.ts`; new `tests/storage/compatibility-integration.test.ts`; new `tests/browser/saved-session.ts`; browser fixtures `abandonment`, `accounts`, `chigorin`, `coaching`, `historical-morphy`, `home`, `interface`, `multiple-tabs`, `offline-origin`, `personality`, `production`, `promotion`, `records`, `reviewer`, `roster-starts`, `roster`, `sound`, `worker`; this report and the frozen audit JSON. No edits to `worker-startup.spec.ts` or frozen playing sources. The coordinator owns the separate inactive engine work and profiling harness.

Resume with Node22.23.0. Finish independent test review, then rerun `VITE_PERSONALITY_BETA=true npx playwright test` against the retained enabled build (or rebuild if runtime source changed). Run final type/lint/format and coordinator-wide integration gates after outstanding edits settle. The default-off desktop suite needs no repeated broad run solely for the already verified wording/policy fixture corrections, but any new runtime changes should determine rerun scope. Full default-off mobile suite was not run; its22-case critical subset completed19 passed/3 explicit skips. Physical-device/screen-reader and blind-style gates remain separate.

Local raw command logs: `/tmp/r19-unit-final.log` (301 tests), `/tmp/r19-browser-off-full.log` (90 pass/35 skip/4 obsolete expectations), `/tmp/r19-browser-off-fixes.log` (7 pass), `/tmp/r19-browser-off-mobile.log` (19 pass/3 skip), `/tmp/r19-build-on.log`, `/tmp/r19-browser-on-full.log` (28 pass/1 interrupted/231 not run). Playwright HTML, trace and screenshots remain in the usual ignored output directories. An earlier typecheck observed the coordinator's then-in-progress literal-type error; the coordinator reported fixing it. R19 does not claim a fresh final whole-source check from that earlier run.

## Resumed verification — 28 September 2026 BDT

The enabled desktop/mobile matrix completed: **255 passed, 5 intentional skips** (13.5 minutes).
The five skips are the desktop audio-tap case, three desktop-only account cases on mobile, and
desktop-only startup measurement on mobile; they are visible skips, not silently passed opponent checks. All enabled opponent,
account, offline, update and recovery journeys executed against the retained enabled artifact.

Independent R19 code review accepted the pending-retention and81-case compatibility changes, but
found that the transient mate-label observer could miss batched changes. Two positive controls
first failed when a mate label was set and restored synchronously, including removal of the bar.
The observer now checks mutation old values and affected/removed nodes. All three observer tests
passed; a subsequent dedicated native-worker browser run passed **4/4** across desktop/mobile.
This targeted run uses the corrected observer; the full matrix started before that correction.

Fresh `npm test -- --maxWorkers=2`: **100 files / 921 tests passed**. The preceding run exposed an
obsolete readonly-update test that expected synchronous activation without the new sole-client
check. It now retains the actual save/export gate, mocks only the browser environment boundary and
awaits completion; six focused tests and independent review passed. The first run also collected two
intentional profiler RED tests while that separate harness was being corrected; those six profiler
tests now pass. No runtime update safeguard was weakened.

Frontend/server TypeScript, full source lint and formatting checks passed. A later profiler-only
formatting change was corrected with Prettier. The enabled offline audit confirms all four emitted
engine workers are precached. The36-file source audit remains35 exact plus the authorized neutral
reviewer difference. Logs for this resume are retained under the plan's ignored ledger directory as
`resume-enabled-browser.log`, `resume-reviewer-browser.log`, `resume-unit-final.log` and the
corresponding source-check logs. Final clean builds/default-off matrix and actual-device gates remain
separate; no publication, deployment or strength claim is made.

The fresh default-off build and offline audit also passed, followed by its full desktop/mobile
browser matrix: **187 passed, 73 intentional skips** (11.2 minutes). The extra skips are the
explicit enabled-only setup journeys; saved historical versions still ran through their retained
compatibility paths. Both flag-state matrices are now complete. Later inactive E2 additions passed
an expanded full suite of101files/927tests; they have no application import path. Fresh enabled
build/accessibility confirmation remains to be recorded below; physical-device/manual gates remain.

Final enabled rebuild succeeded, with all four workers confirmed in the offline precache.
`npm run test:accessibility` against that fresh build scored **97 in Wooden and97 in Dark**,
above the required90. Both reports flagged the missing main-content landmark; this is a retained
minor accessibility issue, not a physical screen-reader pass. Raw Lighthouse reports remain in the
usual ignored verification output; command results are retained in `resume-accessibility.log`.
