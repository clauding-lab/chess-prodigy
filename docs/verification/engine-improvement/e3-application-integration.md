# Local Tal/Fischer integration — 29 September 2026 BDT

Implemented and verified as a local experiment. Not released, rated, strength-qualified,
personality-qualified or physically tested on a phone. No live-player data was used.

## Result

Tal2/tal-coherent-v1 and Fischer2/fischer-coherent-v1 use a separate worker, completed neutral
shortlist evidence and bounded multi-turn plans. Legal documented opening frequencies stay exact.
Both are always unrated. New selection requires both historical and experimental build flags;
supported saves still resume with flags off. Original version1 games/rematches/ratings stay exact.

Incomplete calculations preserve the board and expose Retry. Untimed Home navigation cancels work;
timed navigation preserves the original request/reply deadline. New experimental game settlement,
full snapshots and compact replay use the engine's bishop-only dead-position rule. Older opponents
retain their original rules. No moves after a terminal draw are accepted in experimental histories.

Guest/account authority is v9, guest history v8; every predecessor remains recoverable. Accepting an
experimental identity permanently raises account policy7, including assisted games and raw wire2.
Reset cannot lower it. Exact legacy acknowledgements/outboxes remain intact. The reviewed raw-wire
floor omission and full-format terminal-history gap were reproduced before correction.

## Verification

| Check | Result |
|---|---|
| Full unit/integration suite, Node 22.23.0, two workers |120 files / 1,076 passed|
| Separate real-server suite |12 files / 99 passed|
| Type checking, ESLint, formatting, diff whitespace |Passed|
| Historical enabled, experiment off, full Chrome suite |259 passed / 33 intentional skips|
| Both flags off, full Chrome suite |191 passed / 101 intentional skips|
| Both enabled, dedicated experimental suite |32 passed|
| Clean experimental and default-off builds |Passed|
| Offline asset audit |All 5 engine workers precached|
| Lighthouse accessibility |Wood 97 / Dark 97|
| Axe experimental Home and setup, 390 px |No violations|

Browser results include desktop and phone-size emulation, not physical-device evidence. Dedicated
experimental coverage includes both opponents/colors/all levels, unrated completion/rematch,
save/reload, off-book offline replies, stopped-worker retry, and fresh-browser account restoration.
The last check verifies the second browser's local account state and all 64 rendered squares.
Phone-size Home/setup screenshots were inspected and retained alongside e3-accessibility.json.

The full historical-enabled browser run preceded the final experimental-only terminal correction;
the final default-off, dedicated experimental, full unit and server runs include it. The original
full run's stale authority expectations and CPU-contention timeouts were resolved by correcting
fixtures and bounding concurrent test workers, without relaxing chess deadlines or assertions.

e3-verification-logs.tar.gz retains complete successful logs and selected pre-fix failing regressions.
Additional raw development logs remain in the programme's ignored evidence directory.

Code, TypeScript and security reviewers closed scoped findings. Tests include nonempty history
migration, permanent raw/compact policy floors, exact old acknowledgements, both-color terminal-rule
isolation and legal full/compact corruption rejection. The source audit checks 36 previous source files:
all match pre-integration 744eacf. Three differences versus 4e3a112 are prior coaching/worker repairs,
explicitly listed in e3-frozen-source-audit.json; none arose from this integration.

## Strength development and remaining gates

The independently reviewed development runner freezes source/machine/settings/bundles and 20 swapped
pairs per candidate/level. Each ply uses a fresh Node thread around the real worker entry, with startup
and calculation timing retained separately. Games begin at START and finish only at legal terminal
results. Incomplete, illegal, crashed or capacity-limited games remain unresolved and stop the schedule;
start markers prevent replacement attempts. No games had run when this checkpoint was prepared.

Ten harness tests passed, including real worker execution, full move-metadata rejection and CLI
rejection of changed settings/source/bundles before any game starts. Four pure tactical-analysis
tests cover thresholds, overlapping categories and whole-source-game cluster resampling. The shared
custom reference is not independent chess truth; intervals are approximate and development does not
qualify a candidate. Code/TypeScript reviews approve this development-only scope.

The reviewed follow-up protocol fixes one final submission and complete held-out schedules.
Validation remains unexecuted and unavailable pending development feasibility and a reviewed
complete-schedule assembler. No validation positions were inspected or used for tuning. Owner blind
comparisons, physical-device checks, strength qualification and fresh rated calibration remain open.
No expansion to other masters, push, merge, deployment or release is implied by this checkpoint.
