# R05 — browser ownership and recovery

27 September 2026 BDT. Local repair worktree only; no publication, deployment or player data.

## Implementation

`AccountShell` acquires a real exclusive Web Lock for `guest` or `account:<authenticated id>` before reading/mounting writable guest play or initializing the account outbox. A blocked tab does not mount the game hook or engine. Explicit takeover requests release over BroadcastChannel, then waits for the browser lock before reloading authority. Messages never grant ownership. If messaging is unavailable, takeover waits for the prior tab to close. The browser releases a crashed tab's lock.

Ownership release immediately invalidates saves and disposes account synchronization. Account identity, asynchronous boot request identity and active lease are checked independently. Account refresh results apply only to their original live lease/synchronizer. Pagehide releases ownership and does not write a final whole snapshot. Normal transitions remain promptly persisted; clock settlement still uses elapsed time.

Guest adapters track the monotonic authority revision supplied by the root's new storage format. A stale adapter cannot adopt somebody else's revision merely by retrying. Failed archive writes can refresh the revision of the active write completed during the same synchronous exclusive interval. Account revisions and disposed synchronization guards are implemented in the root-owned sync module.

Unavailable Web Locks block persistent gameplay. Corrupt guest active/history data and blocked storage show recovery before gameplay. Original recovery downloads retain exact string bytes from all guest generations. Reset requires first requesting that download and then explicit confirmation; it writes only the current authority/history generation and retains older recovery keys. The browser cannot verify that a user kept the downloaded file.

Explicit temporary play mounts a separate memory-only adapter and a fresh unrated session, with permanent loss-on-close wording. It never reads/writes the damaged authority, never applies rating receipts, and supports finishing and starting additional games. Storage failures during ordinary play expose current-game export and the separate temporary option.

## Evidence

- Before implementation, the unsupported-lock shell regression failed because normal gameplay mounted and saved anyway. After the gate it passes without any persistent write.
- The lock module's initial test could not import the missing implementation. Its implemented tests cover held ownership, distinct identities, release, missing Web Locks, stale guest revision retry, and unavailable message channels. Message-channel failure was separately RED (lease absent) then GREEN after making the optional handover channel failure tolerant.
- Focused shell, hook, App and coordination tests pass (final combined count recorded by the task report). The temporary hook test finishes two games, applies no receipts, and leaves the original damaged bytes unchanged.
- Actual Chrome desktop journeys cover guest takeover and preserved moved position; second-tab read-only block; close/reacquire; a real renderer crash via Chrome's debugging protocol; unavailable locks and two complete temporary games; corrupt-history exact raw download and explicit reset; storage read/write SecurityError; and real disposable account takeover plus stale-account rejection after switching accounts. No real account or notification service is used.
- Existing App/shell tests were adapted to decode explicit compact snapshots before inspecting reconstructed move history. Their existing engine deadline and rename assertions remain.

## Limits and follow-up gates

Independent review and the candidate-wide suites remain root integration gates. This report does not claim a full browser matrix, physical phone evidence, Safari testing, or production behavior. The account-switch browser test in the older `accounts.spec.ts` suite requires adaptation because it assumed two writable tabs for the same account; that behavior is intentionally blocked now. The new scoped account journey tests the actual ownership boundary and replacement account isolation.

The downloaded-originals reset flow is guest-specific. Existing account recovery/export stays under the account synchronization policy; this task also exposes the root-owned explicit compact-retry action for eligible rejected legacy account saves.

Final scoped result: 46/46 unit/component tests, six actual Chrome desktop browser journeys, production build, TypeScript and scoped ESLint pass. Commands: `npx vitest run tests/account/AccountShell.test.tsx tests/storage/coordination.test.ts tests/game/useGame.test.tsx tests/ui/App.test.tsx`; `npm run build`; `npx playwright test tests/browser/multiple-tabs.spec.ts --project=desktop`; `npm run typecheck`. Preview guest journeys intentionally have no account API on port 4317 and exercise the guest fallback; the account journey uses the disposable full-stack server on port 4318. A final pagehide guard additionally aborts pending takeover requests when leaving a blocked tab; candidate-wide browser validation must include the latest source build.

## Independent-review correction — device alerts

Both independent reviewers identified the same high-priority regression: temporary play could switch an authenticated or blocked-account screen to guest without cancelling that account's browser push subscription. Three focused shell regressions first failed because cancellation was never called. The transition now awaits `reconcileDevicePush(null)` before disposing synchronization, releasing ownership or displaying temporary guest play. Cancellation failure preserves the current account/blocked identity and recoverable pending copy, shows the existing notification error, and permits retry. A newer account request or ownership action invalidates the temporary transition's asynchronous completion.

After correction, all nine account-shell tests pass, including delayed cancellation success, failed cancellation from a blocked account, failed cancellation from a mounted account with a memory-only pending copy, and late cancellation completion after a newer account takeover. These use the real notification reconciliation function with a simulated browser push subscription; no notifications are sent. TypeScript and scoped ESLint pass. Independent re-review and the candidate browser rebuild remain root gates.
