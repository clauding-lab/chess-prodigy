# Historical roster live deployment — 19 September 2026 BDT

The owner explicitly requested “make it live” after final independent approval. Version 2.6.0
is deployed at https://chess.clauding-lab.com with `VITE_PERSONALITY_BETA=true`, enabling Classic,
Morphy, Chigorin, Spassky, Tal and Fischer. No new release tag was created.

## Source and installation

- Main fast-forwarded to the reviewed candidate; the pre-existing approved Home edit was
  preserved in a named stash and patch, and verified already included in the merged code.
- Installed runtime: `362b3b2`, directory `/opt/chess-prodigy/releases/2.6.0-20260919-362b3b2`.
- Source archive SHA-256: `cca208c91d777313ccc3719cd06547bfdada03400c306bfb5c177ffae47cdb2b`,
  verified identically on Mac and Linux. Dependencies installed on Linux, not copied from Mac.
- Subsequent `33fe0b1` changes only test subprocess handling; runtime source is identical.
  Engine/book/worker/calibration playing source remains identical to the accepted freeze.
- Linux Node 22.22.2: typecheck and enabled production build passed. Offline precache includes
  18 entries / 13331.65 KiB. Build logs are retained beside this report.
- Consistent private backup succeeded before preparation and again immediately before activation.
  Atomic symlink switch and restart affected only `chess-prodigy`. No database restore or
  manual player-record modification occurred. Existing release directories remain intact.
- Do not roll back to the old policy-3 release after new roster acceptance. Policy 5, older
  recovery generations, saved identities and fixed receipts require compatible forward fixes.

## Verification

The Linux full run exposed test-only time limits and a Vitest status-message timeout. These
were corrected and independently reviewed; complete failures and focused reruns are retained
in [ci-timeout-diagnosis.md](ci-timeout-diagnosis.md). No failed run is called a clean full run.
All 22 asynchronous subprocess tests passed on Linux without runner errors; complete Chigorin
rebuild passed in 274.48 seconds; both affected tactical cases passed in isolation.

The secret scan's three matches were independently verified SHA-256 source fingerprints,
not credentials. `.gitleaksignore` excludes only those exact historical commit/path/rule/line
matches. Full redacted scanning then passed. No general rule or directory was excluded.

Live checks completed by 22:18 BDT:

- HTTPS `/api/health`: 200, `status: ok`.
- Public leaderboard: 200; unauthenticated private records: 401.
- Fresh Home shows all six enabled opponents and defaults to Dark; screenshot retained.
- Three existing normal-start Playwright cases ran against HTTPS in isolated fresh guests:
  Spassky, Tal and Fischer / Casual / player Black. All 3 passed in 12.5 seconds.
  Each verifies actual native engine reply, exact identity, measured result receipt and reload.
- Service active/running, zero automatic restarts, no error-priority journal entries in the
  checked interval. No real account was used or test account created.
- Agent-browser's click flow did not open setup; the live game checks used the repository's
  established Chrome/Playwright cases instead. No product failure reproduced there.

GitHub verification run: https://github.com/clauding-lab/chess-prodigy/actions/runs/35454056502
Full test, typecheck, lint, format, build and secret-scan stages passed; final browser stage
status is recorded below when complete. Physical-device and manual screen-reader tests were
not performed during this deployment. Installed clients retain the explicit update flow;
no active game was forcibly reloaded.

Run 35454056502 completed all 537 applicable unit tests (one platform-specific skip), plus
source checks, production build and secret scan. Its sequential 232-case desktop/mobile
browser stage reached case 207 without a reported failure before the existing 15-minute
whole-job limit cancelled it. The workflow limit is being increased to 30 minutes; individual
test timeouts and assertions are unchanged. A cancelled run is not a passing full browser run.

The owner subsequently requested the missing GitHub release. The v2.6.0 publication records
this same deployed runtime plus the reviewed test-infrastructure corrections and release docs.
This later request supersedes the deployment-time decision not to create a tag. GitHub rerun
35455038418 remains in progress at release preparation; no clean full browser result is claimed.
