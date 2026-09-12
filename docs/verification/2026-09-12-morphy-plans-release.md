# Direct Morphy plans delivery — 12 September 2026 BDT

Status: **release verification in progress** for Chess Prodigy v2.4.0. The candidate is not yet
recorded here as pushed or live. No additional GitHub release tag is requested.

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
| Source checks at integration checkpoint | Typecheck, lint and formatting passed |
| Production build at integration checkpoint | Default-off build passed, including service-worker generation |
| Version-4 offline browser coverage review | APPROVE; both colors added with real worker and stopped disposable origin |
| Browser-fixture correction | Three focused UI checks and eight focused real-Chrome checks passed at `9b15185` |

The full 426-test and source checks apply to integration commit `da6d784`; the later commit `1cd2135`
adds browser coverage and changes no production source. The final delivery record will identify the
exact reviewed, pushed and deployed commits rather than treating these checkpoints as prospective
release success.

## Release gates still pending

| Gate | Current state |
| --- | --- |
| Full enabled real-Chrome browser suite | Pending controller result |
| Exact-candidate default-off production build | Pending controller result |
| Lighthouse accessibility in dark and wooden themes | Pass; 100/100 each on the enabled build before the copy-only correction |
| Final whole-branch independent review | Pending controller result |
| GitHub CI on exact pushed source | Pending; source not yet recorded as pushed |
| Existing-host backup, target build, activation and live checks | Pending; v2.4.0 not yet recorded as live |

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
passed at correction commit `9b15185`. The browser gate still requires the full enabled rerun.

The release strategy and its practical tradeoffs are preserved in the
[public decision record](morphy-plans/decision-record.md). Physical-device behavior is not inferred
from desktop Chrome or iPhone-size emulation. Practice Ratings describe strength within this app,
not human or FIDE ratings.
