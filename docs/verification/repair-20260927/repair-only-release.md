# Repair-only 2.6.1 candidate — 2 October 2026 BDT

Status: locally verified repair-only candidate; not pushed, published or deployed. The owner approved separating
completed application repairs from the stopped engine experiment. Shipping authorization for this
concrete candidate remains required by the master plan. No production player data was accessed.

## Scope and separation

The candidate repairs save/recovery and account synchronization, compact history, competing browser
tabs, interrupted clocks, neutral coaching, explicit offline updates and retained worker assets.
Server repairs bound public queries, chat and notification work, preserve private ownership and improve
backup/restore checks. New human games use versioned corrected draw rules; older human games retain
their stored rule version. Existing computer terminal policies and measured ratings remain unchanged.
See [findings](findings.md) and the individual repair reports for evidence and remaining dispositions.
This is not a claim that all original findings or engine weaknesses are fixed.

`npm run build:repair` pins `VITE_PERSONALITY_BETA=true VITE_ENGINE_EXPERIMENT=false` at build time.
Normal historical selections remain available, including Tal/Fischer version1. Experimental version2
selection and rematches are blocked. Previously saved experimental games remain recoverable, playable
and offline-capable, always unrated. Removing their compatibility code would strand saves; flag-off
must not be described as removing every experimental engine byte.

The stopped Tal/Fischer programme did not qualify an engine upgrade. Its failed Club gates and partial
complete-game records remain preserved. There is no new playing-policy activation, rating change,
recalibration, retry or improved-strength claim in this release.

## Source audit

Preparation starts at commit `5ecd84c`. The package and lockfile advance together to 2.6.1, with no
new dependency changes in this preparation. The fresh [source audit](repair-only-source-audit.json)
checks all 43 original frozen inputs: 36 are byte-identical and 7 have documented changes:

- Calibration core/protocol/runner: shared estimator constants, validation and explicit exploratory
  evidence handling; these command-line tools do not run the application's opponents.
- Opponent identity: added experimental identities, with a stricter guard preserving version1 rating
  eligibility and preventing experimental versions from inheriting old measured ratings.
- Neutral reviewer and worker client/executor: corrected review semantics and validated asynchronous
  identities. Neutral coaching is separate from opponent playing policy.

No existing playing-search implementation or historical book was modified relative to v2.6.0.
The practice-rating formula remains unchanged; the date conversion was centralized. Added experiment
engines remain unavailable to new games in this build. The audit does not claim all frozen files match.

## Verification

Exact hosted flag-pair build: PASS. Offline asset audit: PASS, all 5 engine workers included in the
service worker cache. Unit suite: 128 files / 1124 tests PASS, including disposable server integration.
Type checking, lint and source formatting: PASS. Separate server suite: 12 files / 99 tests PASS.
Full exact-flag Chrome suite: **259 passed / 33 intentional skips**, desktop and phone-size emulation,
14.2 minutes. Skips cover 28 disabled experimental-selection journeys, three account race checks
already exercised on desktop, one touch-only check on desktop and one desktop-only startup
measurement on mobile. Saved experimental recovery still runs with selection disabled.

Fresh Lighthouse accessibility: **Wooden 97 / Dark 97**, above the required 90. Both retain the
known missing main-content landmark; this is not a perfect-accessibility claim. Earlier default-off
and enabled-experiment matrices remain documented in
[the integration report](../engine-improvement/e3-application-integration.md); this fresh run verifies
the exact hosted repair configuration. No application source changed during candidate preparation.

Independent code and TypeScript/compatibility reviewers approved the separation and current package,
README, changelog and deployment instructions, with no remaining findings. The code reviewer independently
recomputed all 43 source-audit entries and all 17 artifact fingerprints and verified the archive hash.

Physical-phone checks and blind playing comparison were explicitly waived, not performed or passed.
Browser mobile results are emulation. Actual screen-reader behavior remains unverified; automated
scores and announcement-region tests do not establish that manual result. Existing engine weaknesses
remain outside this repair-only claim.

## Upgrade and recovery requirements

Guest state-v9/account-v9/history-v8 preserve every older recovery generation. New compact wire3
acceptance permanently requires policy 6; accepting an experimental identity requires policy 7, including
assisted games. Merely advertising capability 7 does not raise the floor. Reset cannot lower it.
Preserve original wire1/2 pending bytes, acknowledgement identity and ordering.

Follow [deployment instructions](../../../deploy/README.md#repair-only-261-candidate): take a private,
integrity-checked backup; install locked dependencies on Linux; preserve secrets and database ownership;
archive both current and candidate public assets before switching; retain those assets at least 30 days
since last inclusion; configure the existing loopback Cloudflare trust and wait for additive projection
backfill before declaring healthy. Verify guest-only public flows after an authorized cutover.

After compact writes begin, v2.6.0 is not a safe executable rollback. Preserve the database, policy
floors and assets and use a reviewed compatible forward repair. Do not restore an old database to
reverse code deployment. Never force an active game's reload.

## Retained artifact

The exact built frontend is retained locally at
`.superpowers/sdd/2026-09-27-repair-and-engine-master-plan/repair-only-package/chess-prodigy-2.6.1-dist.tar.gz`.
SHA-256: `49e726e6d349c6f318d39d755d4d043e9bc583260cbbb7031e19824a1c353870`.
The [artifact manifest](repair-only-artifact.json) fingerprints every built file. This is the tested
frontend package; the backend must use the same candidate source with Linux-installed dependencies.

Successful command logs and both Lighthouse reports are retained in `repair-only-verification.tar.gz`.
The source is the local `chore(release): prepare verified repair-only 2.6.1 candidate` commit containing
this report; a separate package receipt records its exact commit identifier.
Verification archive SHA-256:
`8c5884bd329a9cb0f114e68def46975db485918a90523b42ef30b29fcb656778`.
