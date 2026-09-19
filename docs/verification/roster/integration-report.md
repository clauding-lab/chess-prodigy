# Historical roster integration — 19 September 2026 BDT

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
