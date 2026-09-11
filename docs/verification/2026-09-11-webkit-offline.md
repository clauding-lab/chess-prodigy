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
