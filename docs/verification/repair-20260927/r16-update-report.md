# R16 — update safety and retained assets

27 September 2026 BDT. Local candidate; no deployment.

All mounted practice/friend update prompts share one readiness registry. Every view must be idle,
save successfully and finish its account-readiness check before explicit activation. A waiting
worker enumerates all scoped browser windows, including uncontrolled ones, and requires only the
requesting window to remain. Unknown/silent workers fail closed. Other windows must be closed,
even if idle; this conservative restriction avoids guessing an old tab's state.

The installed PWA library's `onNeedReload` callback replaces its automatic reload. External
activation cannot authorize this tab's reload. A locally requested activation checks readiness
again before reloading. Later hides the prompt while retaining a discoverable Update available
action after play.

Independent review found an asynchronous lifecycle gap: replacement/unmount during readiness
could approve an unsaved new scope. A reproduced failing regression now passes with registry
generation checks and mounted/request guards. Late service-worker callbacks are ignored after
unmount. Code and TypeScript re-review approved the fix. Thirteen focused tests cover saves,
pending sync, cross-view play, replacement, unmount, external activation and worker enumeration.
Unit callback checks observe calls and UI; the real-browser test observes navigation directly.

The real waiting-worker release-switch test passed in desktop Chrome and mobile-sized Chrome
(two runs). It verifies active-play deferral, an extra same-origin tab blocking activation, exact
game/rating/preference retention and the new HTML release marker after explicit acceptance.
This is browser emulation, not physical-phone evidence. The test uses the current v8 compact save.

Commit 44feae0 supplies the separate public hashed-asset archive. Two CLI/HTTP tests verify atomic
retention, collision refusal, old-worker delivery after current frontend changes, immutable
caching, dotfile rejection and missing-script 404s. Archive installation is still a deployment
operation; minimum retention is 30 days and this implementation deletes nothing.

Account readiness wiring is implemented in the R06 adapter and requires its independent review.
Cold worker startup/real-phone measurement remains outstanding. No worker pooling or frozen
playing-policy changes were introduced.
