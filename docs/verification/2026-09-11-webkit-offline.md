# WebKit offline investigation — evidence

11 September 2026 BDT. Plan: `docs/plans/2026-09-11-webkit-offline.md`.
Persistent checkout `/Users/adnanrashid/Projects/chess-prodigy`.
Branch `codex/webkit-offline-investigation`; base `9460b1c1a15924d17428a78e634d9a91f8a9c100`.
No initial staged, unstaged or untracked changes. Records created before test/app/config changes.

Previous run: 285 tests, source checks/build, 64 Chrome checks (four existing skips), Lighthouse
100 both themes passed. WebKit online reviewer checks passed; offline reload failed internally.
Pre-Run-1 original baseline also showed offline navigation failure. These are retained prior
results, not fresh verification for this continuation.

Fresh baseline: Node 22.23.0, Playwright 1.63.0; macOS 26.6.2; Chrome 152.0.7977.83,
WebKit 26.6 (installed revision 2359). `npm test`: 285 passed / 33 files. Typecheck, lint,
format, build: exit 0. Full browser: 64 passed, four existing skips, exit 0. Accessibility:
wood/dark 100, exit 0. Logs: `/tmp/chess-prodigy-webkit/baseline-*.log`.

## Diagnosis before implementation

`minimal.mjs` creates an independent in-memory HTML/service-worker page, with no chess,
React, Vite, Workbox or push code. Both browsers install/control it and have a cached document.
An uncached network request is confirmed to fail in both outage modes. Results:

| Browser | `context.setOffline(true)` reload / new page | Actual server stopped reload / new page |
| --- | --- | --- |
| Chrome | pass / pass | pass / pass |
| WebKit | internal error / internal error | pass / pass |

`app-comparison.mjs` repeats this matrix for current build and a fresh untouched archive of
`f2b45b7`, built with the same installed locked dependencies. Both builds produce the identical
matrix. With the server stopped both browsers reopen and calculate two legal plies with unchanged
rating. In failing emulation cases registration/control/cache were already confirmed.
Logs: `minimal.log`, `app-comparison.log`, `original-build.log`; scripts retained with recovery.

Conclusion: this installed WebKit/Playwright offline-emulation combination prevents cached
navigation even in the independent minimal page. No Chess Prodigy caching regression identified.
This characterizes the boundary, not the internal WebKit implementation defect or a Safari fix.
Stopping the origin verifies cached operation when the app server is unreachable; it does not
change `navigator.onLine`, simulate device airplane mode or test OS process eviction.

Primary reference: [Playwright service-worker support](https://playwright.dev/docs/service-workers)
is documented for Chromium; [its WebKit build is distinct from shipping Safari](https://playwright.dev/docs/browsers).
Local controlled reproduction, rather than those general limitations alone, supports the finding.

Next: retain a checked server-unavailable browser regression with an uncached negative control,
both colours/profiles, native worker review and unchanged identity/rating. No app fix justified.
Run 3 deferred; existing emulated-offline tests remain intact.

## Supplemental regression checkpoint — passed

Added `playwright.offline.config.ts` and `tests/browser/offline-origin.spec.ts`. Both browsers
exercise Classic/Morphy and both colours with a stopped disposable origin, saved identity/history/
preferences/rating checks, native opponent reply and a complete neutral-review cache. An API fetch
must fail after shutdown. A separate service-worker-blocked browser cannot reopen the document,
excluding HTTP cache as the reason for success. Existing Chromium emulation tests are unchanged.

Initial new suite: two negative controls passed, eight fixture failures (missing required third
`sanFor` argument); explicit strict TypeScript check also caught it. Corrected the test fixture,
then ten checks passed. Independent data-path review identified init-script reseeding that could
hide lost storage. Replaced it with a single storage write before mounting the app. Initial blank
404 setup navigation failed in Chrome (`ERR_HTTP_RESPONSE_CODE_FAILURE`, four failures/six passes);
the disposable test server now serves a minimal 200 setup document. No tested navigation reseeds.
TypeScript review identified cleanup if context creation/closure fails; nested cleanup now always
stops the origin. Reviewers approved the final corrections. Final focused rerun: **10 passed,
exit 0** (`origin-tests-final-rerun.log`): four profile/colour journeys and one negative control
in each browser. No exclusions or retries in the focused configuration.

No application, schema, dependency or PWA policy changes. Canonical ESLint/TypeScript scopes
exclude these test/config files, so explicit strict TypeScript, recommended TypeScript ESLint
and Prettier checks are also run. Initial fixture and setup failures are retained in task logs.

Final `npm test`: **285 passed / 33 files, exit 0**. Canonical typecheck/lint/format, explicit
strict TypeScript/ESLint/Prettier for both new files passed. Final build passed. Expanded full
browser suite: **74 passed, four existing intentional skips, exit 0** (`final-browser.log`, 3.9 min).
The ten new canonical checks cover five journeys in desktop/mobile Chrome. Existing skips remain
three duplicate mobile account journeys and one desktop touch-only sound journey.
Generated tracked screenshots were copied to recovery evidence and restored to prior versions.
No application diff to preserve; test/README/record checkpoint eligible for local commit.

Additional WebKit explicit-update regression passed (one test, exit 0, `webkit-update.log`):
an actual waiting service worker defers during active play, then preserves the save after explicit
acceptance. The PWA configuration, registration/update UI, push handler and locked dependencies
are byte-identical between original f2b45b7 and this continuation's base. Final Lighthouse:
wood/dark 100, exit 0 (`final-accessibility.log`).

## Closeout and preservation

Verified test checkpoint: `f6883f1` after baseline/diagnosis `4ca52bc`. Base remains
`9460b1c1a15924d17428a78e634d9a91f8a9c100`; branch `codex/webkit-offline-investigation`.
After that checkpoint, tracked/staged/untracked diff was empty. This final edit changes only the
two execution records. Final documentation commit ID is recorded in the external recovery README.
No unfinished application/test work remains; main stays `f2b45b701795ea2aa03e89688ced04b8106b5928`.

Recovery: `/Users/adnanrashid/Downloads/chess-prodigy-webkit-recovery-2026-09-11/` contains
task-only `webkit.bundle`/`webkit.patch`, both records, diagnostic scripts/results, fresh baseline/
final logs, Lighthouse reports and synthetic screenshots/failure traces. Bundle verification
passed; patch validation passed against `/tmp/chess-prodigy-webkit/recovery-base`, an untouched
archive of `9460b1c`. Artifacts are refreshed and checked again after this documentation commit.
No credentials, private database or player data included; persistent local copy is not off-device
backup. Prior Run 1/2 recovery exports remain intact and supply earlier prerequisite commits.

Verified: full canonical suite, ten supplemental Chrome/WebKit origin-outage checks and explicit
WebKit update safety. Characterized but still failing: WebKit simulated-offline navigation on this
tool build. Not verified: physical airplane mode, Safari/installed-app cold start or OS eviction.
No application fix, schema/data migration, rating change, release, remote write or live-data action.
Run 3 and later features, strength calibration and naming clearance remain deferred.

Next exact task on a separately invoked Run 3: inspect remaining A4 and archive implementation,
create its execution records, implement bounded guest archive/legal replay/private profile-and-
difficulty rivalry records, then remaining A5 result/rematch integration. Physical device evidence
is still required for full acceptance. This investigation stops here.
