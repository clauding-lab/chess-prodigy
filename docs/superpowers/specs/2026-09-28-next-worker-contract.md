# E1 development worker boundary — 28 September 2026 BDT

Local infrastructure only for the reviewed inactive `next-neutral-shortlist-reuse-v1`. No production
AI/reviewer routes, opponent identities, saves, ratings or UI activation change in this step. This
implements the approved E1 completeness/recovery boundary before later E3 actual-app integration.

Use a separate protocol/client/worker. Inputs carry monotonically increasing request ID, game ID,
revision, position, prior FEN history excluding root, exact policy and difficulty. Freeze limits at
maxDepth8, candidateWindow100, capture4/safety12, baselineOnlyfalse; budgets200/600/2000ms. Search
budget starts when the worker executes, matching measured search budgets. Startup latency remains
a separate actual-browser measurement at integration. Main-thread watchdog includes1000ms startup margin. Do not disguise this as end-to-end timed
play evidence. Future actual-app clock integration must separately cap the request to remaining time.

Clone caller input before dispatch. Replies echo request/game/revision identity. Validate policy,
position/history fingerprint, perspective, frozen settings, discriminated outcome, finite scores and
legal move coverage before resolving. Completed candidate sets must cover every legal root exactly
once; selected move has an exact score equal to the returned best. Exact scores cannot beat selected
best; exclusion bounds have the correct side and fall strictly outside the100cp window. Baseline
contains only exact scores. Terminal and incomplete outcomes have no move/candidates. Ordinary
incompletion resolves as such, without automatic substitution/retry or rating effect.

A superseding request, cancel or dispose terminates its worker and rejects the pending promise.
Ignore late replies from replaced workers and mismatching identities. Crash/message-decode/invalid
reply/watchdog gets one bounded retry; a second failure rejects with a recoverable error. Never treat
a malformed completed result as ordinary incomplete. Fresh worker per attempt bounds state lifetime.
The actual application integration remains a later task: it must preserve position and expose retry
for incomplete/failure, and cannot present this foundation as a playable new opponent.
