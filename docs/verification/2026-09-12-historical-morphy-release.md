# Historical Morphy delivery — 12 September 2026 BDT

Status: compatibility implementation has passed review; final application verification is in progress. Production
still runs the completed Home/Resume release v2.2.1. This record will identify the exact verified source
and deployment after the remaining checks pass.

The owner explicitly approved documented-game moves in matching positions, preferences learned from
Morphy's games elsewhere, and a new strength measurement before rated release, following Home.
Implementation, source push and deployment use the existing hosting authorization. No additional
GitHub release tag is requested.

## Accepted historical policy and measurement

The source collection yields 247 validated normal games, 6,940 recorded positions and 7,020 distinct
continuations. Only Morphy's own turns enter the repertoire. Setup/odds records, malformed games,
team-player records and one conflicting Nb1/Kb1 game are excluded with retained provenance. The
importer and a real reimport regression passed independent review. See the
[source record](morphy-history/README.md).

Historical-v1 is attack-development version 3. At a matching nonterminal position it selects only legal
documented moves, weighted by occurrence. Elsewhere, the existing custom search uses learned preferences
bounded at 250 centipawns, without changing material values or importing Classic's repertoire. The
first fixed fit improved held-out top-choice prediction from 135/456 to 140/456, and log loss from
2.60335 to 2.56769. All 57 held-out whole games stayed outside fitting; no tuning followed the first
result. The model reproduced byte for byte and passed independent review. These are modest descriptive
prediction gains, separate from playing strength. See the [model record](morphy-history/model-report.md).

The frozen `5428825` harness played 400 complete games from START under production search limits.
An independent audit replayed every result, verified all source identities and recomputed the
predeclared checkpoint decisions. Accepted version-3 values are:

| Level | Games | Wins / draws / losses | Fixed Practice Rating | Approximate interval |
| --- | ---: | ---: | ---: | --- |
| Casual | 200 | 165 / 26 / 9 | 1275 | 1133.02–1393.38 |
| Club | 100 | 33 / 43 / 24 | 1375 | 1265.13–1497.58 |
| Strong | 100 | 15 / 60 / 25 | 1775 | 1648.81–1881.47 |

Casual required the planned extension after its first 100-game interval was too wide. No game was
unresolved. The source archive, 27 fingerprints, all raw results and all published bundle checksums
passed independent verification. Configured/invoked maximum concurrency was eight workers; no
continuous process-count trace was retained. A rejected Node 26.3.1 initialization contained zero
games; all accepted play used Node 22.23.0. See the
[complete measurement and limitations](morphy-history/measurement-report.md).

## Compatibility requirements

Version 1 remains an unrated beta. Version 2 retains style-v1 and immutable values 1200 / 1375 / 1825.
New setup selects historical version 3; saved games and rematches preserve their original version.
Earlier-game wording explains that distinction. Hints and takebacks exclude rating, and settlement,
forfeit and undo must retain their existing once-only receipt rules.

The new local authority is state-v4/account-v4/history-v3 with all prior recovery copies and pending
account versions preserved. Wire schema stays 2. The persistent account policy rises to minimum 2 on
accepting version 3, including assisted games, and survives reset. Older incompatible clients must not
overwrite that progress. Home/Resume, elapsed clocks, original coaching, Classic, human matches and
private ownership remain in scope for final regression checks.

## Compatibility verification

Commit `168a2ed` passed 397 unit/integration tests across 43 files, frontend/server type checking,
lint and formatting under Node 22.23.0. New behavioral tests failed before implementation and then
verified exact versioned receipts, assisted exclusions, undo/forfeit/reload, prior-key migration,
pending account versions, corrupt-authority recovery and supported historical resume with the flag off.
Authenticated SQLite tests cover additive migration, assisted version-3 protection, conflicting writes
without policy/archive side effects, and protection surviving Classic, reset and server restart.

Independent Task 4 review found no blocking issue. Its one minor finding was a stale earlier-opponent
rematch explanation after selecting a different opponent; the browser-verification task includes the
focused correction and regression. Existing central account parsers consume the updated exact
eligibility without a wire-schema rewrite. Expected invalid-password warnings come from pre-existing
negative authentication tests.

The measured playing policy remains frozen: comparison from `5428825` through `168a2ed` shows no
change to search, historical features/model, repertoire/corpus, or calibration/training code. The sole
engine-directory difference enables rated eligibility for supported version 3 in `opponents.ts`.

## Final application verification

The completed source passes 399 unit/integration tests across 44 files plus canonical type checking,
lint and formatting. The rematch correction has two test-first regressions: version wording follows
the selection while the independent unavailable-clock warning remains. One older completion test
was updated to check both visible messages rather than assuming they shared a paragraph.

The complete default-off browser suite passed 108 checks with eight expected skips in five minutes.
Four skips require enabled new-opponent selection; three are existing phone-size account-race
variants, and one requires a touch device. The enabled production build passed 73 targeted checks
with three expected skips in three minutes. Both commands explicitly selected the enabled flag for
that second run. Coverage includes both colors, documented opening choices, old-save migration,
version-preserving rematches, current-opponent selection, account receipts/archive/reload, old-client
rejection, Home, forfeit, neutral review and explicit waiting updates.

Offline journeys actually stop a disposable origin, then reopen, play, review and archive games for
Classic and all three Morphy versions on both screen sizes. Lighthouse scored 100 in both themes,
including passing contrast checks. The [phone-size dark Home](morphy-history/ui-20260912/mobile-dark.png)
and [desktop wooden Home](morphy-history/ui-20260912/desktop-wood.png) were visually inspected.
Preview-only guest tests retain expected connection diagnostics because their optional account
backend at port 4317 is absent; authenticated checks use the separate disposable server at 4318.

## Production

Whole-branch review and production verification remain pending. No new production deployment is
claimed by this checkpoint.

Detailed local evidence is retained in
`/Users/adnanrashid/Downloads/chess-prodigy-historical-morphy-20260912/`. A separate isolated guest
session holds a v2 Club game with moves e4/Nf6 for the real update check; no live player account is used.
Physical-device installation, audio and performance evidence remains separate from browser emulation.

## Implementation decisions

These record the controller's decisions in execution order, including their practical cost if wrong.

1. Proceed under the approved design and existing hosting authorization. No new service or player-data
   access was added. An incorrect scope interpretation would require reverting the additional work.
2. Measure complete games from the starting position, because the repertoire is part of the opponent.
   This prevents a direct causal comparison with the earlier protocol's six prescribed half-moves; changing that
   choice would require a separate measurement.
3. Hold out whole serious games from preference fitting, and disable repertoire lookup in historical
   prediction checks. Shared openings can still correlate across games; stronger claims would need
   another independently specified validation set.
4. Fix the corpus container as games plus holdout IDs, and the runtime book as position-to-move/count
   entries. Unmatched serious records are reported. A different downstream requirement would need a
   data-format migration and regenerated artifacts.
5. Before fitting, use bounded neutral capture search rather than material alone to score successors.
   This accounts for immediate recaptures and costs preprocessing time; changing it would require
   refitting, fresh validation and measurement under a new opponent version.
6. Exclude both legal but conflicting Morphy–Löwenthal scores, whose final moves differ as Kb1/Nb1.
   Preserve their identities and a real reimport regression. This sacrifices one potentially valid
   game; an authoritative correction can be considered in a future version.
7. Review generated data with structured artifact checks and complete legal replay, alongside full
   source/test/provenance review. This avoids obscuring importer logic in a large JSON diff; a missed
   provenance issue would require correcting the corpus and revalidating its dependants.
8. Bring canonical historical-tool checking forward from Task 5 to resolve the Task 2 lint gate.
   Ignore only the skill's scratch directory and preserve equivalent parser behavior. A coverage
   mistake would require adjusting tooling; generated artifacts were checked unchanged.
