# Direct Morphy plans delivery — 12 September 2026 BDT

Status: **complete and live** as Chess Prodigy v2.4.0 at https://chess.clauding-lab.com, verified at
22:47:10 BDT on 12 September 2026. Pushed verification tip is
`e273553ad61029facd4ab806acc7647a2123da6a`; deployed application source is `48d21aa`. This final
record follows as verification-only documentation. No additional GitHub release tag was requested.

The owner approved a designed Morphy-inspired policy in the actual app after the learned experiments
failed their separate acceptance criteria. New Paul Morphy games use version 4 / `plans-v1` when the
existing personality feature is enabled. Documented legal opening choices and their occurrence
frequencies remain exact. Outside those positions, the engine favors development, useful central
breaks and coordinated king attacks among alternatives within 100 centipawns of its best completed
neutral search. Endgames use neutral search. These engineering rules do not certify perceived style,
historical thought or tactical perfection.

## Measurement and preserved opponents

The exact reviewed playing source `d8c376dd7613fa53e72e6850462f68e7b60cc877` played 400 complete
games from START under production limits and color-swapped pairs. The independently accepted fixed
Practice Ratings for version 4 are:

| Level | Games | Wins / draws / losses | Fixed Practice Rating | Approximate interval |
| --- | ---: | ---: | ---: | --- |
| Casual | 200 | 159 / 26 / 15 | 1225 | 1097.47–1333.23 |
| Club | 100 | 19 / 78 / 3 | 1400 | 1288.85–1523.30 |
| Strong | 100 | 5 / 41 / 54 | 1625 | 1481.68–1745.83 |

All games reached a legal terminal result. The independent audit replayed all 400 games and 31,168
plies, verified both colors and exact seeds for all 200 pairs, recalculated all four retained
checkpoints, and rehashed all 279 frozen source files. Casual's 50-pair checkpoint was retained but
was not eligible because its interval width was 311.159, above the declared 300-point limit. See the
[measurement report](morphy-plans/measurement-report.md) and its public evidence bundle.

Version 1 remains unrated. Version 2 keeps 1200 / 1375 / 1825 and version 3 keeps
1275 / 1375 / 1775 for their saved games and explicit rematches. No earlier receipt is repriced.
Hints and takebacks still exclude rating.

## App integration and compatibility

The reviewed integration makes version 4 current while retaining one visible Paul Morphy choice.
Saved games and rematches preserve versions 1–3 and their exact policies. Current guest, account and
history authority advances to state-v5, account-v5 and history-v4, with every older generation kept
in recovery order. A corrupt current save still blocks silent fallback, and pending account writes
retain their base versions and ordering.

Wire schema remains 2. Current account writes send rating policy 3. Accepting any version-4 snapshot,
including an assisted game, permanently raises that account's minimum policy to 3. Classic games,
rating reset and server restart cannot lower the floor. Conflicting, malformed and unsupported-future
requests neither write nor raise it. Raw wire acknowledgements remain exact. After version-4 progress
is accepted, v2.3 is not a compatible rollback; recovery requires a forward fix that preserves the
database, policy table and all save generations.

## Completed local evidence

| Check | Result |
| --- | --- |
| Engine-policy task review | APPROVE; no open findings; 80 diagnostic decisions and 30 fingerprints independently checked |
| Frozen measurement review | APPROVE; 400 games, 31,168 legal plies and 279 source files independently audited |
| Rated integration review | APPROVE; TypeScript, account ownership, SQLite transaction and policy-floor paths reviewed |
| Unit/integration suite at integration checkpoint | 426 passed across 46 files |
| Fresh unit/integration suite on pushed main | 426 passed across 46 files in 7.05 seconds |
| Source checks at integration checkpoint | Typecheck, lint and formatting passed |
| Production build at integration checkpoint | Default-off build passed, including service-worker generation |
| Version-4 offline browser coverage review | APPROVE; both colors added with real worker and stopped disposable origin |
| Browser-fixture correction | Three focused UI checks and eight focused real-Chrome checks passed at `9b15185` |

The full 426-test and source checks apply to integration commit `da6d784`; the later commit `1cd2135`
adds browser coverage and changes no production source. The final delivery record will identify the
exact reviewed, pushed and deployed commits rather than treating these checkpoints as prospective
release success.

## Release gates

| Gate | Current state |
| --- | --- |
| Full enabled real-Chrome browser suite | Pass; 118 passed and four intentional skips in 5.6 minutes |
| Post-fix default-off production build | Pass at source commit `9b15185` |
| Post-fix enabled production build | Pass with literal `VITE_PERSONALITY_BETA=true` at source commit `9b15185` |
| Lighthouse accessibility in dark and wooden themes | Pass; 100/100 each on the rebuilt enabled candidate |
| Final source/spec/TypeScript/security and evidence review | APPROVE at `e273553`; no open findings |
| GitHub CI on exact pushed source | Pass: [run 34705686358](https://github.com/clauding-lab/chess-prodigy/actions/runs/34705686358) |
| Linux candidate install/typecheck/enabled build | Pass on Node 22.22.2 from archive of `48d21aa` |
| Isolated Linux candidate smoke check | Pass; health and frontend 200 with synthetic SQLite, notifications off and application closed afterward |
| Candidate asset identity | Pass; all 13 target asset hashes match the retained local manifest |
| Existing-host backup and atomic activation | Pass; backup service succeeded before switching to the v2.4 candidate |
| Public asset and isolated-guest live checks | Pass at 22:47:10 BDT |

Documentation commit `48d21aa` follows the two post-fix builds and does not change application or
build inputs.

## Server candidate and activation

Archive `48d21aa` was uploaded to the existing Hetzner host with SHA-256
`a5e4c10b484c512c33fb0453d0b07860b7bdc4da2d506e4bdd974f3b9f4a9e39`. The hash matched on the
target. A clean locked install, typecheck and literal-`true` enabled build passed on Linux x64 with
Node 22.22.2 under `/opt/chess-prodigy/releases/2.4.0-20260912-48d21aa-plans`.

Candidate source remains exactly `48d21aa`; later pushed commits contain verification documents only.
Before activation, the controller verified that exact diff and that public assets match the locally
rebuilt enabled bundle. Any runtime, build-configuration or package change would have required a new
candidate archive and build. This record identifies candidate source and the later evidence commit
separately rather than claim the whole Git trees are byte-identical.

The exact `48d21aa..e273553` comparison contains 13 files, all under `docs/verification/`; runtime,
tests, package metadata and build configuration are unchanged. Main was fast-forwarded and pushed at
`e273553ad61029facd4ab806acc7647a2123da6a`. A fresh main test run passed 426 tests across 46 files
in 7.05 seconds. Final source and evidence review approved that tip with no open findings.

Before activation, the standalone Linux candidate used a new synthetic SQLite database, disabled
notifications and an ephemeral loopback port. Health returned 200/ok and the frontend returned 200
referencing `assets/index-BozyUQuP.js`; the application closed cleanly afterward. All 13 candidate
asset hashes match [the retained local manifest](morphy-plans/release-assets.sha256). This did not
read or modify a live player account or record.

GitHub CI passed both jobs on exact pushed tip `e273553`. It repeated source checks, 426 unit and
integration tests across 46 files, the default-off build, secret scanning and the default-off browser
matrix. The browser job passed 114 checks with eight intentional skips in 6.9 minutes.

The consistent private backup service reported success with exit status 0 before the atomic current
link switched to `/opt/chess-prodigy/releases/2.4.0-20260912-48d21aa-plans`. The application service
is active and loopback health returns 200/ok; three initial connection retries occurred within the
bounded ten-attempt restart check. No database restore occurred and no secret or live player record
was read. At 22:47:27 BDT, the final service query reported active/running, exit status 0 and zero
restarts.

## Live verification

At 22:47:10 BDT, public health returned 200/ok with `Cache-Control: no-store`, and all 13 public
application assets matched the retained release inventory. An isolated 390×844 Chrome guest opened
with the permanent dark default and displayed version-4 values Casual 1225, Club 1400 and Strong
1625. A fresh rated version 4 / `plans-v1` game played legal `h3 … Nc6`; neither move was a recorded
book move. Reload returned Home with Resume and preserved the exact game ID, move history and
opponent configuration. The browser reported no page errors.

Machine-readable results are retained in the [live check](morphy-plans/live-check.json), with the
[mobile setup](morphy-plans/live-setup-mobile.png) and [resumed game](morphy-plans/live-game-mobile.png)
screenshots.

The live check used guest storage only. It did not inspect, create or change a real player account or
record, and it did not exercise notifications. Browser emulation at 390×844 is not physical-device
evidence. No new tag was created.

An earlier local browser invocation built with `VITE_PERSONALITY_BETA=true` but omitted the flag from
the Playwright process. Its expected flag-mismatch failures were interrupted with exit 130 and are
retained as a discarded invocation, not acceptance evidence or an application defect. Preview-only
guest journeys may log expected connection refusals to the absent optional account API on port 4317;
authenticated journeys use the disposable server on 4318.

The first correctly enabled full run finished in 5.8 minutes with 115 passed, four intentional skips
and three failures. Two failures were stale desktop/mobile personality expectations of 1375 where the
accepted version-4 Club value is 1400. The third occurred before its game began, when a disposable
mobile account registration received HTTP 429 from Better Auth's five-signups-per-300-seconds limit.
That test lacked the stable per-test forwarded IP already used by other account journeys, so its sixth
parameterized registration shared a rate-limit identity. A separate minor visual observation found
location-specific “above” wording in the same UI area; it was not an assertion failure. The run and
complete test results are retained as pre-fix diagnostic evidence. The scoped fixture repair gives
the test its own deterministic project/test identity and updates the v4 expectation and wording;
production rate limits remain unchanged. Three focused UI checks and eight focused browser checks
passed at correction commit `9b15185`, then the full enabled matrix was rerun.

The resulting full enabled rerun passed all 118 executed checks in desktop Chrome and iPhone 13
emulation in 5.6 minutes. Its four intentional skips were the desktop-only touch-audio case and three
mobile duplicates of account session/conflict/preference cases. Coverage includes actual version-4
worker moves, both colors, old-version resume/rematch, rated account completion and restore, policy
protection, stopped-origin offline reopening, neutral review, Home/clocks and explicit waiting
service-worker updates. Expected preview-only connection refusals to the absent optional port 4317
account API remain harness diagnostics; account journeys use the disposable port 4318 server.

The release strategy and its practical tradeoffs are preserved in the
[public decision record](morphy-plans/decision-record.md). Physical-device behavior is not inferred
from desktop Chrome or iPhone-size emulation. Practice Ratings describe strength within this app,
not human or FIDE ratings.
