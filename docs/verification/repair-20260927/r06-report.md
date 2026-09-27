# R06 — session expiry, device alerts and pending sign-out

27 September 2026 BDT. Local candidate only; no commit, publication, deployment, real accounts or external notification delivery in this pass.

Authenticated 401 responses carry their originating account identity into the shell. Only the current writer's account is expired. The recovery notice and sign-in action are above both practice and multiplayer; expired accounts cannot show Saved to account. AccountSync freezes expired sessions, aborts requests and ignores late successes, bodies and failures without acknowledging away the pending queue.

Device push mutations use one exclusive browser Web Lock, a durable device generation captured before asynchronous permission, and a fresh authenticated-session identity check. Stale permission/queued work is rejected after generation changes. A stale A account cannot unsubscribe B's subscription. Browser cancellation remains mandatory even when server deletion succeeds. Failed cancellation blocks guest/account switching. Offline cancellation is limited to the still-owned account subscription under the same lock/generation checks. Browsers unable to coordinate safely fail closed when device alerts need reconciliation.

Sign-out tries synchronization for at most 2.5 seconds, then offers Cancel or explicit sign-out retaining the private pending copy. All account/legacy recovery keys remain. Failed durable saves require an exported copy of the exact current recovery content; content is checked again after asynchronous sign-out before disposing the old account. Expired sign-out 401 is accepted as ended. A private account-bound logout intent records offline sign-out because JavaScript cannot clear the server's HttpOnly cookie. Subsequent session discovery or sign-in finishes the logout only for that same account; an A intent cannot log out B. A changed intent generation is not deleted by an older completion. If neither local intent storage nor server logout succeeds, switching remains blocked.

The account adapter implements R16's additive prepareUpdate contract: bounded flush, zero pending writes, idle state and the same still-active writer are all required.

## Evidence

- Test-first reproduction: the new late-save expiry test failed with `idle/pending=0` instead of `signed-out/pending=1`; expired sign-out rejected rather than completing. Both pass after the fix.
- `npx vitest run tests/account`: 10 files, 90 tests pass. Covers authenticated multiplayer expiry, another account's late expiry, expired sign-out, offline pending sign-out plus cancellation/private retention, shell push-unsubscribe failure, stale A versus B, late permission, serialized generation changes, retained logout identity, bounded stalled flush and preservation of account generations/history.
- `npm run typecheck`: passes frontend and server checking with Node 22.
- Targeted ESLint over changed source files: passes. Project ESLint excludes test files; no claim of test-file lint coverage.
- Prettier applied to touched files.
- Existing account-name fixture emits a NaN rendering warning because its fake multiplayer rating has the wrong shape; its regression test passes. No production rating calculation changed here.

Independent review is still required. Browser mocks validate lock sequencing and account isolation; this is not physical-device notification evidence. Frozen playing policy, ratings, receipt semantics, wire acknowledgements and old storage generations remain unchanged.

## Independent review fixes — 28 September 2026 BDT

The first review found three recovery regressions. Added nine failing tests before changes: no-alerts/no-Web-Locks temporary entry, successful cancellation with quota failure, six malformed/bounded logout-marker inputs and SecurityError on marker reads. All now pass.

No-subscription browsers without Web Locks can enter temporary play; browsers with an actual subscription still require coordination. Generation reservation happens before enabling; subscription creation fails closed if that reservation is not durable. Cancellation under the lock may complete despite generation-write quota failure, with current account/owner checks preserved, so successful browser cancellation no longer blocks online logout solely due to quota.

Logout markers are bounded and shape validated. Invalid bytes are retained. Invalid/unreadable markers expose an explicit “End server session and recover sign-in” action, which must complete authenticated server logout before allowing fresh authentication for this page lifetime. Original marker bytes are never overwritten/deleted by this recovery action. Valid pending logout markers continue to be honored, including ones arriving from another tab after recovery. Reloading with the same unrepaired invalid marker requires recovery again. No assumption is made that unreadable storage is empty.

Final focused result: `npx vitest run tests/account` passes 102 tests across 10 files, including mounted-shell no-lock/no-alerts temporary play and invalid-marker recovery. No physical-device/browser claim is added; these are component and API tests.

## Independent review round 2 — 28 September 2026 BDT

Security review reproduced a pending A permission returning after temporary guest entry when quota prevented generation advancement. Added the exact regression and unreadable-generation/no-alerts regression first; both failed. Cancellation now falls back to verified account-bound server logout **inside the same exclusive push lock** when durable generation advancement fails. The lock is not released until logout completes. Old permission work then fails its fresh session check even for an initially absent generation. If offline conditions prevent that fallback, switching remains blocked; successful browser cancellation alone is insufficient to permit guest entry in this case.

Generation reads represent unavailable storage explicitly. Enabling requires readable ownership plus durable generation. Cancellation/reconciliation may proceed under the lock with a verified session and either a durable generation or completed logout. This avoids the unreadable-storage authentication loop without treating denied storage as empty.

The mounted-shell regression traverses denied getItem → explicit session recovery → fresh sign-in → private storage recovery → temporary play with a service worker, working locks and no push subscription. All 105 account tests pass. Frontend/server typecheck and targeted source lint pass. These supersede the round-1 quota-only cancellation description above.

## Independent review round 3 — 28 September 2026 BDT

Corrected the mounted regression to deny both storage reads and writes and return authenticated-records 401 after its mock server session ends. This failed before the fix, exposing that the cancellation fallback wrongly logged out a newly authenticated account during account entry.

Push operations now distinguish enabling, intentional session exit and authenticated account entry. Account entry checks the current session under the same lock and reconciles any actual prior subscription, but does not advance a generation or invoke fallback logout: the existing authenticated account has not been exited. A different authenticated account already rejects the previous account's pending permission through its identity check. Intentional guest transitions and detach retain the generation-or-server-logout barrier inside the lock.

The corrected mounted test proves the session remains authenticated at the private-storage warning and ends only upon explicit temporary guest entry, even with both getItem/setItem denied. The pending-permission/quota security regression remains green. All 105 account tests pass; frontend/server typecheck and source lint pass.
