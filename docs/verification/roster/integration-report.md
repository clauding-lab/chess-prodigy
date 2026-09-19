# Historical roster activation — 19 September 2026 BDT

Activation commit `abea87a`. Local version **2.6.0** enables the independently accepted exact version-1 identities when
`VITE_PERSONALITY_BETA=true`; source defaults remain off. Frozen playing source is unchanged
from `9a7ab6c4eaba629d87cec8f77a163660ecdd240c`. No push, deployment, tag or live-player data
action occurred. Whole-branch final independent review is supplied separately by the controller.

| Opponent | Casual | Club | Strong | Complete benchmark games |
| --- | ---: | ---: | ---: | ---: |
| Spassky | 1150 | 1325 | 1700 | 300 |
| Tal | 1200 | 1325 | 1700 | 400 |
| Fischer | 1250 | 1350 | 1675 | 400 |

The independent audit records in each player directory accepted all 1,100 games / 87,731 plies
with no unresolved games. Tal and Fischer Casual extended to the first eligible 100-pair checkpoint;
all other levels stopped at 50 pairs. These values measure play against fixed Classic anchors;
they establish neither human/FIDE strength nor perceived historical style. No measurement was rerun.

New normal games and eligible rematches settle exactly one fixed receipt. Older beta active games
remain unrated on completion and preserve existing unrelated rating progress; forged beta receipts
are rejected. Assistance, undo, archived identity and policy-5 persistence remain protected.

## Final activation verification

All commands used Node 22.23.0 via `source /Users/adnanrashid/.nvm/nvm.sh && nvm use --silent`.
Retained command logs and screenshots are in [activation/](activation/); [summary.json](activation/summary.json)
contains the extracted HTML report totals and Lighthouse scores. Committed log copies normalize
trailing whitespace; original local command logs remain in the Task 4 evidence directory.

| Check | Result |
| --- | --- |
| Full `npm test` | 62 files / 535 tests passed, exit 0 |
| Final above-floor receipt / undo / beta compatibility tests | 10 passed, exit 0 |
| Typecheck, lint, source formatting, browser fixture formatting | All passed, exit 0 |
| Enabled and default-off 2.6.0 production builds | Both passed; 18 precache entries / 13,331.67 KiB each |
| Earlier full enabled browser matrix | 183 passed, 1 failed, 4 skipped / 188; 0 flaky |
| Full default-off browser matrix | 160 passed, 6 failed, 22 skipped / 188 |
| Corrected default-off account cases | 6 passed, exit 0 |
| Final enabled 2.6.0 focused matrix | 54 passed, no skipped/flaky/failed, exit 0 |
| Lighthouse accessibility, Wooden and Dark | 100 / 100, exit 0 |

These are separate runs, not one clean full-suite claim. The enabled full run's single failure was
an outdated 2.7-built About screen after package metadata was restored to approved 2.6.0. The final
2.6 build passes both desktop/mobile About cases. The default full run's six failures were test-only
account-rematch assertions that ignored the default-off flag. The corrected six cases pass. An earlier
focused enabled run had 38 passes / 6 stale rematch expectation failures; the subsequent
full enabled run exercised those corrected assertions. The first default attempt was stopped after
its guest rematch assertion ignored the build flag; the completed full default matrix supersedes it.

The final 54 cases comprise 44 fresh normal-start paths, two Home/accessibility cases, six private
account cases and two About/version cases. Fresh starts exercise all three new players, all levels,
both colors on desktop/mobile, plus Morphy Club/Strong both colors. Existing enabled full-suite
coverage supplies Chigorin all levels/colors and Morphy Casual both colors. Every fresh path uses
Home Play → difficulty/color → Start, receives a native engine reply, resigns, verifies the exact
fixed opponent receipt and retains a single count on reload. Fresh ratings stay at the preserved
1400 floor on a loss; the final unit checks separately verify nonzero loss deltas from valid 1600
progress for all nine new identities/levels and exact undo. The first new-start test attempt wrongly
expected a decrease below 1400 (18 failed, one interrupted, 34 not run, one passed); it was stopped
and corrected without altering product behavior, then the complete 54-case run passed.

The full matrices retain guest/account separation, all player/level/color native workers, offline
reload/next moves, neutral coaching, cancel/retry, Home resume/forfeit, elapsed clocks, recorded
history/replay/rematch, original opponent generations, unknown identity rejection and corrupt-save
recovery. Policy 5 survives assisted saves, reset and restart; policies 1–4 and exact original wire
acknowledgements remain covered by the 535-test run. Stored beta games remain unrated and do not
reprice unrelated progress. Above-floor checks were added afterward and the affected 10 tests rerun.

[Final desktop Home](activation/roster-home-desktop.png) and
[final mobile Home](activation/roster-home-mobile.png) show six concise cards, simplified Morphy,
measured Chigorin and direct Wikipedia/Play controls. Fresh play screenshots for
[Spassky](activation/play-spassky-mobile.png), [Tal](activation/play-tal-mobile.png) and
[Fischer](activation/play-fischer-mobile.png) show the actual board and coaching; desktop copies
are alongside them. Visual inspection found no clipped cards/controls, Home axe found zero
violations and both viewport checks reject horizontal overflow. Keyboard/dialog and accessible
board-label checks pass; no manual physical screen-reader or physical-phone result is claimed.
The mobile surface is Chrome with iPhone-size emulation, not a physical iPhone.

Expected isolated-preview `/api/auth/get-session` proxy refusals at unused port 4317 are retained
in browser logs. Private account tests instead use the disposable full-stack server at 4318.
No live-player database or real notification delivery is used. Browser and preview jobs were closed
after completion. Playing policies, helpers, books and repertoires remain byte-identical to the
accepted frozen source; only fixed rating activation changed runtime source in this task.

## Preserved pre-activation integration evidence

The following records describe the earlier gated candidate, before rating activation; their null-rating
and closed-setup statements are historical, not the current behavior.

Implementation commit `e6aa9d9`. Local2.6.0 candidate, following accepted Task1 source `66e328da50b69e017be49466398ac529ef1b2084`.
Spassky/Tal/Fischer version1 are recognized together with account policy5 and
state-v7/account-v7/history-v6. All three rating slots remain null; new setup and rematch stay
closed pending independent fresh measurements. Saved beta games remain unrated. No release,
strength benchmark or deployment is claimed by these checks.

## Verification

All Node commands used `source /Users/adnanrashid/.nvm/nvm.sh && nvm use --silent`.

- `npm run typecheck`, `npm run lint`, `npm run format:check`: pass.
- `npx vitest run tests/game tests/worker tests/storage tests/account tests/server tests/ui tests/calibration`:
  44files/311tests pass. Latest targeted roster game/UI/protocol checks:17/17pass.
- `VITE_PERSONALITY_BETA=true npm run build`: pass,18precached assets.
- `VITE_PERSONALITY_BETA=true npx playwright test tests/browser/roster.spec.ts`:44/44pass,
  zero skipped/flaky,3.4minutes. Full clean run after correcting fixture-only clock/counter errors.
- `env -u VITE_PERSONALITY_BETA npm run build`: pass,18precached assets.
- `env -u VITE_PERSONALITY_BETA npx playwright test tests/browser/roster.spec.ts tests/browser/worker.spec.js tests/browser/production.spec.js`:
  56/56pass, zero skipped/flaky,4.0minutes.
- Explicit browser fixture Prettier check and `git diff --check`: pass.

Both builds use actual Chrome desktop and iPhone-size Chrome emulation. Each roster matrix covers
all three opponents, all difficulties and both player colors. It verifies native dedicated worker
selection, saved identity, untimed and10+0 games, offline next moves, neutral review in the old
worker, unrated receipts, legal replay, gated rematch, private account assistance/archive/reload,
policy5 after reset and unauthenticated denial. Default checks also exercise unchanged Classic,
keyboard/dialog access, both themes, old worker retry and corrupt-current-save preservation.

All earlier authority locations remain recovery sources. New tests cover guest/account v6 and
all earlier keys, history v5 and earlier, current corruption and failed new-key durability before
outbox transmission. Server integration retains policies1–4 for eligible older records while
permanently refusing stale4 after any accepted new opponent, including assisted games/reset/restart.
Existing canonical legacy-wire acknowledgement checks pass.

Unknown configurations remain readable for local recovery. Server writes separately require a
supported exact identity: the read-only parser is insufficient authority to accept a new write.
The server derives a terminal archive and its minimum policy from the incoming active snapshot;
there is no client-provided archive owner or archive list. Authentication still derives ownership.

## Worker assets and startup

The same emitted worker files occur in enabled and default-off builds; each is explicitly present
in the offline precache and below the8MiB (8,388,608byte) per-file limit. No source games or book
entries were removed.

| Worker | File | Bytes |
|---|---|---:|
| Existing/neutral | engine.worker-D9kUuCr4.js |2,490,290|
| Spassky | spassky.worker-DL8CjyrC.js |4,129,879|
| Tal | tal.worker-D95GCTnn.js |4,710,016|
| Fischer | fischer.worker-zZNSM36C.js |1,870,291|

Default main bundle:383,827bytes. Neither browser main nor the old worker imports the new books.
The Node calibration dispatcher imports the same three pure policies; its manifest binds all
transitive books/helpers, exact opponent identity and influencing scripts/configuration.

[Raw native worker evidence](native-worker-startup.json) contains72 clean-run cases:36 for each
build, with desktop/mobile, color, level, worker URL, online/offline AI and neutral-review timings.
Each AI case replies once without retry. Times measure Worker constructor→reply, including loading,
parsing and computation. Localhost and browser emulation do not establish real-phone/network speed.

| Build | Player | Maximum online ms | Maximum offline ms |
|---|---|---:|---:|
| Enabled | Spassky |127.7|1524.7|
| Enabled | Tal |118.7|898.0|
| Enabled | Fischer |53.4|871.8|
| Default-off | Spassky |127.5|1526.1|
| Default-off | Tal |107.8|897.0|
| Default-off | Fischer |57.2|859.6|

The larger offline times are Strong calculations; every test individually checks its unchanged
client watchdog: Casual1200ms, Club1600ms, Strong3000ms. No timeout widening was used.

[Desktop Home](home-pending-desktop.png) and [mobile Home](home-pending-mobile.png) retain the
approved six-card layout, dark default, direct Wikipedia links and pending-measurement gates.
Home axe checks find zero violations; mobile has no horizontal overflow.

All accepted new Task1 policy/helpers/books and old Classic/Morphy/Chigorin playing modules remain
unchanged. These are integration checks, not proof of perceived style or accepted strength.
