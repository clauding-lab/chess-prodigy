# Recovery and capacity contract — execution design

27 September 2026 BDT. Implements the approved R03/R05/R08/R09/R19 scope. This design is prospective until activation tests pass; checkpoint 1 still writes the existing authorities.

## Capacity and representation

Use a new explicit compact snapshot version 3 at persistence/transport boundaries while retaining Session version 2 in memory. Store legal move coordinates/promotion, pre-move clocks and opening provenance. Reconstruct board positions, SAN, repetition counts and all history before accepting a save. Motifs are recalculated from legal moves. Neutral evaluations and annotations are derived caches: new compact saves omit them, and review recomputes them from the retained full move history. No moves, opponent identity, clock, assistance flag, rating, receipt or preference may be discarded. Old wire versions remain readable and their exact original acknowledgements remain unchanged.

Bound new compact snapshots to 2 MiB of UTF-8 and 12,800 half moves. The app automatically ends on 100 half moves without a pawn move/capture. Each of the 16 original pawns can make at most six moves (96 total), and at most 30 non-king pieces can be captured, including promoted pieces replacing pawns. Thus at most 126 reset events partition at most 127 intervals of at most 100 half moves: 12,700 is a conservative upper bound under this app's current rule. The slightly higher 12,800 processing bound accommodates every such legal game; it is not an invented rated draw limit. Board/legal replay validation remains authoritative. Browser quota exhaustion is a separate recoverable failure; no storage system can promise infinite capacity.

Bound compact scalar metadata and tuples before legal replay. Legacy oversized pending envelopes remain raw/exportable and may be migrated only after checking that the represented game/rating/receipt is identical. Never silently replace a rejected/attempted wire item because its response may have been lost. Legal zero repetition entries disappear only from a newly encoded representation; original recovery bytes remain.

Archives retain 200 visible games. Keep one bounded eviction recovery record tied to the current reversible terminal game and its receipt; finalize it when moving on, restore it if that terminal is undone, and never let a different game consume that restoration. The server implements the same operation transactionally. This adds authority and requires a new generation/policy.

## Authority migration

Activate guest state-v8, account-v8 and history-v7 together after integration tests; retain v7/v6 and every earlier key for recovery. Compact snapshot version 3 is explicit rather than reinterpreting wire schema 2. Server exact acknowledgements return the representation sent. Persistent minimum client policy 6 follows the first accepted repair-format snapshot, including assisted games and reset; old clients receive upgrade-required before stale conflict and cannot overwrite newer progress. Do not deploy/roll back to code that ignores this floor.

Attempted pending items carry an immutable raw wire representation alongside their validated in-memory projection. Queue coalescing touches only unattempted items. Both successful acknowledgements and lost-response recognition compare the raw sent representation at exactly the expected next server version.

## Cross-tab and interruption contract

Acquire one exclusive browser lock for the guest or specific account identity before mounting a writable game or initializing a mutable outbox. A blocked tab offers explicit takeover only after the prior writer releases; reload authority under the lock. Attach an increasing revision to local authority and reject stale asynchronous work. A storage event informs the interface but never substitutes for atomic ownership. If locking is unavailable, block persistent writes with recovery and offer explicitly temporary unrated play.

A temporary session is separate, never writes over damaged persistent state, and is visibly loss-on-close. It must allow finishing and starting further temporary games. Export existing corrupt active/history bytes before any explicit reset. No automatic recovery-key deletion.

An interrupted computer timeout uses a new explicit unrated reason, carried only by the new authority/policy. Keep elapsed clock settlement and outcomes; distinguish actual running computation from closed/suspended/error states. Existing receipts never change retrospectively.

## Activation gate

Golden old generations, exact old pending acknowledgements, compact round trips, legal 240/250/501+ move histories, excessive zero keys, hostile bounded input, quota failures, cap finish/undo/reload, simultaneous tabs, account replacement and policy-floor persistence must pass. All representation changes receive independent review before activation. Existing engine-policy source and historical receipts stay frozen.
